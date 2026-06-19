import { getAdminServices } from "./_admin.js";
import { settleFinalEvents } from "./maintenance.js";

export const maxDuration = 30;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function bearerToken(req) {
  const auth = String(req.headers.authorization || "");
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
}

async function requireAdmin(req, services) {
  const token = bearerToken(req);
  if (!token) {
    const error = new Error("Admin login token is missing.");
    error.status = 401;
    error.code = "AUTH_TOKEN_MISSING";
    throw error;
  }

  const decoded = await services.auth.verifyIdToken(token);
  const profileSnap = await services.db.collection("users").doc(decoded.uid).get();
  const profile = profileSnap.exists ? profileSnap.data() : {};
  if (!profile.approved || !profile.isAdmin) {
    const error = new Error("An approved administrator account is required.");
    error.status = 403;
    error.code = "ADMIN_REQUIRED";
    throw error;
  }
  return decoded.uid;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  if (req.method === "OPTIONS") return json(res, 204, {});
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  let stage = "initializing Firebase Admin";
  try {
    const services = getAdminServices();
    stage = "verifying administrator";
    const adminUid = await requireAdmin(req, services);
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const eventId = String(body.eventId || "").trim();
    if (!eventId) return json(res, 400, { error: "eventId is required", code: "EVENT_ID_REQUIRED" });

    stage = "loading event";
    const eventSnap = await services.db.collection("events").doc(eventId).get();
    if (!eventSnap.exists) return json(res, 404, { error: "Event not found", code: "EVENT_NOT_FOUND", eventId });
    const event = { firestoreId: eventSnap.id, ...eventSnap.data() };
    const isFightCard = event.type === "FIGHT_CARD" || event.league === "UFC" || Array.isArray(event.fights);
    const hasCompletedFight = isFightCard && (event.fights || []).some(fight =>
      Boolean(event?.fightResults?.[fight?.id] || fight?.winner)
    );
    if (String(event.status || "").toLowerCase() !== "final" && !hasCompletedFight) {
      return json(res, 409, { error: "Event has no completed result available for settlement yet.", code: "EVENT_NOT_SETTLEMENT_READY", eventId, status: event.status || "unknown" });
    }

    stage = "loading event financial records";
    const [betsSnap, matchesSnap, ledgerSnap] = await Promise.all([
      services.db.collection("bets").get(),
      services.db.collection("matches").get(),
      services.db.collection("ledgerEntries").get()
    ]);
    const rows = snap => snap.docs.map(doc => ({ firestoreId: doc.id, ...doc.data() }));

    stage = "settling available results";
    const settlement = await settleFinalEvents(
      services.db,
      services.FieldValue,
      [event],
      rows(betsSnap),
      rows(matchesSnap),
      rows(ledgerSnap)
    );

    return json(res, 200, {
      ok: true,
      eventId,
      adminUid,
      settlement,
      runtime: process.version,
      version: "10.77"
    });
  } catch (error) {
    console.error("settle-event failed", { stage, error });
    return json(res, Number(error.status) || 500, {
      error: error.message || "Event settlement failed.",
      code: error.code || "SETTLE_EVENT_FAILED",
      stage,
      runtime: process.version,
      version: "10.77"
    });
  }
}
