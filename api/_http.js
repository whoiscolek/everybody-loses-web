export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  if (typeof res.end === "function") return res.end(JSON.stringify(body));
  if (typeof res.status === "function" && typeof res.json === "function") return res.status(status).json(body);
  return undefined;
}

export function requestQuery(req = {}) {
  if (req.query && typeof req.query === "object") return req.query;
  try {
    const host = String(req.headers?.host || "localhost");
    const parsed = new URL(String(req.url || "/"), `http://${host}`);
    return Object.fromEntries(parsed.searchParams.entries());
  } catch {
    return {};
  }
}

export function requestBody(req = {}) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body !== "string" || !req.body.trim()) return {};
  try {
    return JSON.parse(req.body);
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.status = 400;
    error.code = "INVALID_JSON";
    throw error;
  }
}

export function bearerToken(req = {}) {
  const authorization = String(req.headers?.authorization || "");
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}
