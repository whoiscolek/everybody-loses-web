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
  const text = String(raw || "").trim();
  const candidates = [text];
  try {
    candidates.push(Buffer.from(text, "base64").toString("utf8").trim());
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

let servicesPromise = null;

async function initializeAdminServices() {
  let appSdk;
  let firestoreSdk;
  let authSdk;

  try {
    [appSdk, firestoreSdk, authSdk] = await Promise.all([
      import("firebase-admin/app"),
      import("firebase-admin/firestore"),
      import("firebase-admin/auth")
    ]);
  } catch (cause) {
    const error = new Error(`Firebase Admin SDK could not be loaded: ${cause?.message || cause}`);
    error.code = "ADMIN_SDK_IMPORT_FAILED";
    error.cause = cause;
    throw error;
  }

  const serviceAccount = parseServiceAccount();
  if (!serviceAccount) {
    const error = new Error(
      "Firebase Admin credentials are missing or malformed. In Vercel, set FIREBASE_SERVICE_ACCOUNT_JSON to the complete service-account JSON (plain JSON or base64), or set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY."
    );
    error.code = "ADMIN_CREDENTIALS_MISSING";
    throw error;
  }

  try {
    const app = appSdk.getApps().length
      ? appSdk.getApps()[0]
      : appSdk.initializeApp({
          credential: appSdk.cert(serviceAccount),
          projectId: serviceAccount.project_id
        });

    return {
      db: firestoreSdk.getFirestore(app),
      auth: authSdk.getAuth(app),
      FieldValue: firestoreSdk.FieldValue,
      Timestamp: firestoreSdk.Timestamp,
      projectId: serviceAccount.project_id
    };
  } catch (cause) {
    const error = new Error(`Firebase Admin initialization failed: ${cause?.message || cause}`);
    error.code = cause?.code || "ADMIN_INITIALIZATION_FAILED";
    error.cause = cause;
    throw error;
  }
}

export async function getAdminServices() {
  if (!servicesPromise) {
    servicesPromise = initializeAdminServices().catch(error => {
      servicesPromise = null;
      throw error;
    });
  }
  return servicesPromise;
}

export function resetAdminServicesForTests() {
  servicesPromise = null;
}
