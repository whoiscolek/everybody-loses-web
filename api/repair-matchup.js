import { getAdminServices } from "./_admin.js";

export const maxDuration = 30;

const EVENT_TYPES = {
  TEAM: "TEAM_HEAD_TO_HEAD",
  FIGHT_CARD: "FIGHT_CARD"
};

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function bearerToken(req) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}

function clean(value) {
  return String(value || "").trim();
}

function sameAmount(a, b) {
  return Math.abs(Number(a) - Number(b)) < 0.000001;
}

async function requireAdmin(req, services) {
  const token = bearerToken(req);
  if (!token) {
    const error = new Error("Missing Firebase sign-in token.");
    error.status = 401;
    throw error;
  }

  let decoded;
  try {
    decoded = await services.auth.verifyIdToken(token);
  } catch {
    const error = new Error("Your sign-in session is invalid or expired. Sign out and back in, then retry.");
    error.status = 401;
    throw error;
  }

  const userSnap = await services.db.collection("users").doc(decoded.uid).get();
  const user = userSnap.data() || {};
  if (!userSnap.exists || user.approved !== true || user.isAdmin !== true) {
    const error = new Error("This account is not authorized to repair matchups.");
    error.status = 403;
    throw error;
  }

  return decoded.uid;
}

async function firstQueryDoc(query) {
  const snap = await query.limit(1).get();
  return snap.empty ? null : snap.docs[0];
}

async function resolveEvent(db, input) {
  const raw = clean(input);
  const upper = raw.toUpperCase();
  if (!raw) return null;

  const directCandidates = [...new Set([raw, upper])];
  for (const id of directCandidates) {
    const snap = await db.collection("events").doc(id).get();
    if (snap.exists) return snap;
  }

  const shortCode = await firstQueryDoc(db.collection("events").where("shortCode", "==", upper));
  if (shortCode) return shortCode;

  for (const value of directCandidates) {
    const byId = await firstQueryDoc(db.collection("events").where("id", "==", value));
    if (byId) return byId;
  }

  return null;
}

function normalizeTeamPick(value) {
  const pick = clean(value).toLowerCase();
  return ["away", "home"].includes(pick) ? pick : "";
}

function normalizeFightPick(value) {
  const pick = clean(value).toLowerCase();
  if (pick === "fightera") return "fighterA";
  if (pick === "fighterb") return "fighterB";
  return "";
}

function findFight(event, rawFightId) {
  const needle = clean(rawFightId);
  return (event.fights || []).find(fight =>
    clean(fight.id) === needle ||
    clean(fight.order) === needle ||
    clean(fight.label) === needle
  ) || null;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    return json(res, 204, {});
  }

  if (req.method !== "POST") return json(res, 405, { error: "Use POST." });

  try {
    const services = getAdminServices();
    const adminUid = await requireAdmin(req, services);
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

    const eventSnap = await resolveEvent(services.db, body.eventId);
    if (!eventSnap) return json(res, 404, { error: "Event not found. Check the internal event ID or display code." });

    const event = { id: eventSnap.id, ...eventSnap.data() };
    const canonicalEventId = clean(event.id || eventSnap.id);
    const userA = clean(body.userA);
    const userB = clean(body.userB);
    const amount = Number(body.amount);

    if (!userA || !userB || userA === userB) {
      return json(res, 400, { error: "Choose two different users." });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return json(res, 400, { error: "Enter a valid amount greater than zero." });
    }

    const [userASnap, userBSnap] = await Promise.all([
      services.db.collection("users").doc(userA).get(),
      services.db.collection("users").doc(userB).get()
    ]);
    if (!userASnap.exists || !userBSnap.exists) {
      return json(res, 400, { error: "One of the selected user accounts no longer exists." });
    }

    let fightId = "";
    let pickA = "";
    let pickB = "";

    if (event.type === EVENT_TYPES.TEAM) {
      pickA = normalizeTeamPick(body.pickA);
      pickB = normalizeTeamPick(body.pickB);
      if (!pickA || !pickB) return json(res, 400, { error: "Team picks must be away and home." });
    } else if (event.type === EVENT_TYPES.FIGHT_CARD) {
      const fight = findFight(event, body.fightId);
      if (!fight) return json(res, 400, { error: "Enter a valid UFC fight number or fight ID." });
      fightId = clean(fight.id);
      pickA = normalizeFightPick(body.pickA);
      pickB = normalizeFightPick(body.pickB);
      if (!pickA || !pickB) return json(res, 400, { error: "UFC picks must be fighterA and fighterB." });
    } else {
      return json(res, 400, { error: "Matchup repair currently supports team games and UFC fights." });
    }

    if (pickA === pickB) return json(res, 400, { error: "The two users must have opposite picks." });

    const [betsSnap, matchesSnap] = await Promise.all([
      services.db.collection("bets").where("eventId", "==", canonicalEventId).get(),
      services.db.collection("matches").where("eventId", "==", canonicalEventId).get()
    ]);

    const bets = betsSnap.docs.map(docSnap => ({ ref: docSnap.ref, firestoreId: docSnap.id, ...docSnap.data() }));
    const matches = matchesSnap.docs.map(docSnap => ({ ref: docSnap.ref, firestoreId: docSnap.id, ...docSnap.data() }));
    const betsById = new Map();
    for (const bet of bets) {
      betsById.set(clean(bet.firestoreId), bet);
      if (bet.id) betsById.set(clean(bet.id), bet);
    }

    const affectedUsers = new Set([userA, userB]);
    const displacedBetIds = new Set();
    const matchesToDelete = [];

    for (const match of matches) {
      if (match.status === "settled") continue;
      if (event.type === EVENT_TYPES.FIGHT_CARD && clean(match.fightId) !== fightId) continue;
      if (!affectedUsers.has(clean(match.userA)) && !affectedUsers.has(clean(match.userB))) continue;

      matchesToDelete.push(match);
      if (match.betA) displacedBetIds.add(clean(match.betA));
      if (match.betB) displacedBetIds.add(clean(match.betB));
    }

    const existingBetA = bets.find(bet =>
      clean(bet.userId) === userA &&
      (event.type !== EVENT_TYPES.FIGHT_CARD || clean(bet.fightId) === fightId) &&
      clean(bet.side) === pickA &&
      sameAmount(bet.amount, amount)
    );
    const existingBetB = bets.find(bet =>
      clean(bet.userId) === userB &&
      (event.type !== EVENT_TYPES.FIGHT_CARD || clean(bet.fightId) === fightId) &&
      clean(bet.side) === pickB &&
      sameAmount(bet.amount, amount)
    );

    const betARef = existingBetA?.ref || services.db.collection("bets").doc();
    const betBRef = existingBetB?.ref || services.db.collection("bets").doc();
    const matchRef = services.db.collection("matches").doc();
    const batch = services.db.batch();
    const timestamp = services.FieldValue.serverTimestamp();

    for (const match of matchesToDelete) batch.delete(match.ref);

    const selectedBetIds = new Set([
      clean(existingBetA?.firestoreId || betARef.id),
      clean(existingBetB?.firestoreId || betBRef.id)
    ]);

    for (const displacedId of displacedBetIds) {
      if (selectedBetIds.has(displacedId)) continue;
      const bet = betsById.get(displacedId);
      if (bet) batch.update(bet.ref, { status: "open", updatedAt: timestamp });
    }

    const commonBetFields = {
      eventId: canonicalEventId,
      amount,
      doubleUp: { requestedBy: [], applied: false, originalAmount: amount },
      status: "matched",
      adminRepaired: true,
      repairedBy: adminUid,
      updatedAt: timestamp
    };

    if (existingBetA) {
      batch.update(betARef, { ...commonBetFields, side: pickA, fightId });
    } else {
      batch.set(betARef, {
        id: betARef.id,
        ...commonBetFields,
        type: event.type,
        userId: userA,
        side: pickA,
        fightId,
        createdAt: timestamp
      });
    }

    if (existingBetB) {
      batch.update(betBRef, { ...commonBetFields, side: pickB, fightId });
    } else {
      batch.set(betBRef, {
        id: betBRef.id,
        ...commonBetFields,
        type: event.type,
        userId: userB,
        side: pickB,
        fightId,
        createdAt: timestamp
      });
    }

    batch.set(matchRef, {
      id: matchRef.id,
      type: event.type,
      eventId: canonicalEventId,
      fightId,
      betA: betARef.id,
      betB: betBRef.id,
      userA,
      userB,
      sideA: pickA,
      sideB: pickB,
      amount,
      doubleUp: { requestedBy: [], applied: false, originalAmount: amount },
      status: "matched",
      adminRepaired: true,
      repairedBy: adminUid,
      createdAt: timestamp,
      updatedAt: timestamp
    });

    await batch.commit();

    return json(res, 200, {
      ok: true,
      message: `Match repaired successfully. Removed ${matchesToDelete.length} conflicting match${matchesToDelete.length === 1 ? "" : "es"} and created the intended match.`,
      eventId: canonicalEventId,
      matchId: matchRef.id,
      betAId: betARef.id,
      betBId: betBRef.id
    });
  } catch (error) {
    console.error("repair-matchup failed", error);
    return json(res, Number(error.status) || 500, {
      error: error.message || "Matchup repair failed."
    });
  }
}
