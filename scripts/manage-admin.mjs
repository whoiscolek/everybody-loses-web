import { getAdminServices } from "../api/_admin.js";

function argument(name) {
  const prefix = `--${name}=`;
  const inline = process.argv.find(value => value.startsWith(prefix));
  if (inline) return inline.slice(prefix.length).trim();
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? String(process.argv[index + 1] || "").trim() : "";
}

function requestedAction() {
  if (process.argv.includes("--grant")) return "grant";
  if (process.argv.includes("--revoke")) return "revoke";
  return "";
}

async function main() {
  const action = requestedAction();
  const uidInput = argument("uid");
  const email = argument("email").toLowerCase();

  if (!action || (!uidInput && !email) || (uidInput && email)) {
    throw new Error("Usage: npm run admin:manage -- --grant|--revoke --uid <uid> OR --email <email>");
  }

  const services = await getAdminServices();
  const userRecord = email ? await services.auth.getUserByEmail(email) : await services.auth.getUser(uidInput);
  const isAdmin = action === "grant";

  const profilePatch = {
    id: userRecord.uid,
    email: userRecord.email || email || "",
    isAdmin,
    updatedAt: services.FieldValue.serverTimestamp()
  };
  if (isAdmin) profilePatch.approved = true;

  await services.db.collection("users").doc(userRecord.uid).set(profilePatch, { merge: true });

  console.log(`${isAdmin ? "Granted" : "Revoked"} administrator access for ${userRecord.email || userRecord.uid}.`);
}

main().catch(error => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
