function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function escapeText(value) {
  return String(value ?? "").replace(/[<>]/g, "").trim();
}

function money(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "$0";
  return `$${num.toFixed(2).replace(/\.00$/, "")}`;
}

function formatTime(value) {
  if (!value) return "TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function buildEmail({ recipient, requester, event, match, appUrl }) {
  const requesterName = escapeText(requester?.displayName || "Someone");
  const eventTitle = escapeText(event?.title || "an event");
  const league = escapeText(event?.league || "");
  const code = escapeText(event?.shortCode || event?.id || "");
  const time = formatTime(event?.startTime);
  const originalAmount = money(match?.originalAmount);
  const doubleAmount = money(match?.doubleAmount);
  const expires = formatTime(match?.expiresAt);
  const url = appUrl || "https://everybody-loses-web.vercel.app";

  return {
    to: recipient.email,
    subject: `${requesterName} wants to double up on ${eventTitle}`,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.45;color:#111827;max-width:560px;margin:0 auto;padding:24px;">
        <h2 style="margin:0 0 12px;letter-spacing:-.03em;">Double up challenge 👎</h2>
        <p style="margin:0 0 16px;color:#374151;">${requesterName} wants to double your matched bet. You have 5 minutes from when they sent it to accept in the app.</p>
        <div style="border:1px solid #e5e7eb;border-radius:16px;padding:16px;background:#f9fafb;">
          <p style="margin:0 0 8px;"><strong>${eventTitle}</strong></p>
          <p style="margin:0;color:#4b5563;">${league}${league ? " · " : ""}${time}${code ? ` · ${code}` : ""}</p>
          <p style="margin:12px 0 0;color:#111827;">Current bet: <strong>${originalAmount}</strong></p>
          <p style="margin:4px 0 0;color:#111827;">If accepted: <strong>${doubleAmount}</strong></p>
          <p style="margin:8px 0 0;color:#6b7280;font-size:13px;">Expires around ${expires} ET.</p>
        </div>
        <p style="margin:18px 0 0;"><a href="${url}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;border-radius:999px;padding:10px 14px;font-weight:800;">Open Everyone Loses</a></p>
        <p style="margin:18px 0 0;color:#6b7280;font-size:12px;">You are receiving this because email bet notifications are enabled in your profile.</p>
      </div>
    `,
    text: `${requesterName} wants to double up your matched bet on ${eventTitle}. Current: ${originalAmount}; if accepted: ${doubleAmount}. Expires around ${expires} ET. Open Everyone Loses: ${url}`
  };
}

async function sendWithResend(email, from, apiKey) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from, ...email })
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.message || data?.error || `Resend failed with ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return json(res, 204, {});
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  try {
    const apiKey = process.env.RESEND_API_KEY || "";
    const from = process.env.NOTIFICATION_FROM_EMAIL || "Everyone Loses <onboarding@resend.dev>";
    const appUrl = process.env.APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || "";
    const { recipient = {}, requester = {}, event = {}, match = {} } = req.body || {};

    if (!recipient?.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(recipient.email))) {
      return json(res, 200, { sent: 0, skipped: true, reason: "No valid opted-in recipient." });
    }

    if (!apiKey) return json(res, 200, { sent: 0, skipped: true, reason: "RESEND_API_KEY is not configured in Vercel." });

    const email = buildEmail({
      recipient,
      requester,
      event,
      match,
      appUrl: appUrl ? `https://${String(appUrl).replace(/^https?:\/\//, "")}` : ""
    });

    const result = await sendWithResend(email, from, apiKey);

    return json(res, 200, {
      sent: 1,
      failed: 0,
      id: result?.id || ""
    });
  } catch (error) {
    return json(res, error.status || 500, {
      error: error.message || "Failed to send double-up notification."
    });
  }
}
