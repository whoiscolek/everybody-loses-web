export const EVENT_TYPES = Object.freeze({
  TEAM: "TEAM_HEAD_TO_HEAD",
  RANKED: "RANKED_FINISH",
  FIGHT_CARD: "FIGHT_CARD"
});

export function hasScore(score) {
  return Boolean(score)
    && Number.isFinite(Number(score.away))
    && Number.isFinite(Number(score.home));
}

export function normalizeToken(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export const normalizeTeamToken = normalizeToken;

export function sanitizeId(value) {
  return String(value || "event")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 140) || "event";
}

export function eventIdentityValues(event = {}) {
  const ids = [
    event.firestoreId,
    event.id,
    event.apiEventId,
    event.externalIds?.espnEventId,
    event.externalIds?.mlbGamePk,
    event.externalIds?.apiEventId,
    event.externalIds?.eventId,
    event.externalIds?.f1Round,
    event.externalIds?.indyCarEventId,
    event.externalIds?.nascarEventId,
    event.externalIds?.motogpEventId
  ];
  return [...new Set(ids.map(value => String(value || "").trim()).filter(Boolean))];
}

export function recordBelongs(record, event) {
  const eventIds = new Set(eventIdentityValues(event));
  return eventIds.has(String(record?.eventId || ""));
}

export function ufcFightHasResult(event = {}, fight = {}) {
  return Boolean(event?.fightResults?.[fight?.id] || fight?.winner);
}
