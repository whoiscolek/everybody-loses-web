import { getAdminServices } from "./_admin.js";
import { bearerToken, sendJson as json } from "./_http.js";
import { APP_NAME, APP_VERSION } from "./_version.js";

export const maxDuration = 15;

async function authorize(req, services) {
  const token = bearerToken(req);
  const maintenanceSecret = process.env.MAINTENANCE_SECRET || process.env.CRON_SECRET || "";
  if (maintenanceSecret && token === maintenanceSecret) return { kind: "scheduler" };
  if (!token) {
    const error = new Error("Administrator login token is missing.");
    error.status = 401;
    error.code = "AUTH_TOKEN_MISSING";
    throw error;
  }

  const decoded = await services.auth.verifyIdToken(token);
  const profileSnap = await services.db.collection("users").doc(decoded.uid).get();
  const profile = profileSnap.exists ? profileSnap.data() : {};
  if (profile.approved !== true || profile.isAdmin !== true) {
    const error = new Error("An approved administrator account is required.");
    error.status = 403;
    error.code = "ADMIN_REQUIRED";
    throw error;
  }
  return { kind: "admin", uid: decoded.uid };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  if (req.method === "OPTIONS") return json(res, 204, {});
  if (!["GET", "POST"].includes(req.method)) return json(res, 405, { error: "Method not allowed" });

  let stage = "loading Firebase Admin SDK";
  try {
    const services = await getAdminServices();
    stage = "verifying administrator";
    const authorization = await authorize(req, services);
    stage = "reading Firestore maintenance state";
    const maintenanceSnap = await services.db.collection("system").doc("maintenance").get();
    const maintenance = maintenanceSnap.exists ? maintenanceSnap.data() : {};

    return json(res, 200, {
      ok: true,
      app: APP_NAME,
      version: APP_VERSION,
      runtime: process.version,
      firebaseProject: services.projectId,
      authorizedAs: authorization.kind,
      maintenanceRecordFound: maintenanceSnap.exists,
      maintenanceVersion: maintenance.maintenanceVersion || maintenance.lastAttemptVersion || "",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("admin-health failed", { stage, error });
    return json(res, Number(error.status) || 500, {
      ok: false,
      error: error?.message || "Firebase backend health check failed.",
      code: error?.code || "ADMIN_HEALTH_FAILED",
      stage,
      version: APP_VERSION,
      runtime: process.version
    });
  }
}
