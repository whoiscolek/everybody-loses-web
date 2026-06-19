import { sendJson as json } from "./_http.js";
import { APP_NAME, APP_VERSION } from "./_version.js";

export const maxDuration = 10;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return json(res, 204, {});
  if (!['GET', 'HEAD'].includes(req.method)) {
    return json(res, 405, { ok: false, error: "Method not allowed", version: APP_VERSION });
  }

  const body = {
    ok: true,
    app: APP_NAME,
    version: APP_VERSION,
    runtime: process.version,
    timestamp: new Date().toISOString()
  };

  if (req.method === "HEAD") {
    res.statusCode = 200;
    res.setHeader("Cache-Control", "no-store");
    return res.end();
  }

  return json(res, 200, body);
}
