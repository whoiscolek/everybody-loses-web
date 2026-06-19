import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

function normalizePrivateKey(value) {
  return String(value || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\\n/g, "\n");
}

function normalizeServiceAccount(parsed = {}) {
  const projectId = parsed.project_id || parsed.projectId || process.env.FIREBASE_PROJECT_ID || "everyone-loses";
  const clientEmail = parsed.client_email || parsed.clientEmail || process.env.FIREBASE_CLIENT_EMAIL || "";
  const privateKey = normalizePrivateKey(parsed.private_key || parsed.privateKey || process.env.FIREBASE_PRIVATE_KEY || "");
  if (!projectId || !clientEmail || !privateKey) return null;
  return { project_id: projectId, client_email: clientEmail, private_key: privateKey };
}

function parseServiceAccountJson(raw) {
  const candidates = [String(raw || "").trim()];
  try {
    candidates.push(Buffer.from(String(raw || ""), "base64").toString("utf8").trim());
  } catch {
    // Plain JSON remains the primary format.
  }

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate);
      const normalized = normalizeServiceAccount(parsed);
      if (normalized) return normalized;
    } catch {
      // Try the next representation.
    }
  }
  return null;
}

function parseServiceAccount() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    const parsed = parseServiceAccountJson(json);
    if (parsed) return parsed;
  }
  return normalizeServiceAccount({});
}

export function getAdminServices() {
  if (!getApps().length) {
    const serviceAccount = parseServiceAccount();
    if (!serviceAccount) {
      const error = new Error(
        "Firebase Admin credentials are missing or malformed. In Vercel, set FIREBASE_SERVICE_ACCOUNT_JSON to the complete service-account JSON (plain JSON or base64), or set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY."
      );
      error.code = "ADMIN_CREDENTIALS_MISSING";
      throw error;
    }

    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
  }

  return {
    db: getFirestore(),
    auth: getAuth(),
    FieldValue,
    Timestamp
  };
}
