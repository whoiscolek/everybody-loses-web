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

function buildEmail({ recipient, bettor, event, bet, appUrl }) {
  const bettorName = escapeText(bettor?.displayName || "Someone");
  const eventTitle = escapeText(event?.title || "an event");
  const league = escapeText(event?.league || "");
  const pick = escapeText(bet?.pick || "a pick");
  const amount = money(bet?.amount);
  const code = escapeText(event?.shortCode || event?.id || "");
  const time = formatTime(event?.startTime);
  const url = appUrl || "https://everybody-loses-web.vercel.app";

  return {
    to: recipient.email,
    subject: `${bettorName} placed a bet on ${eventTitle}`,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.45;color:#111827;max-width:560px;margin:0 auto;padding:24px;">
        <h2 style="margin:0 0 12px;letter-spacing:-.03em;">Someone placed a bet 👎</h2>
        <p style="margin:0 0 16px;color:#374151;">${bettorName} placed an open bet you may want to match.</p>
        <div style="border:1px solid #e5e7eb;border-radius:16px;padding:16px;background:#f9fafb;">
          <p style="margin:0 0 8px;"><strong>${eventTitle}</strong></p>
          <p style="margin:0;color:#4b5563;">${league}${league ? " · " : ""}${time}${code ? ` · ${code}` : ""}</p>
          <p style="margin:12px 0 0;color:#111827;"><strong>${amount}</strong> on <strong>${pick}</strong></p>
        </div>
        <p style="margin:18px 0 0;"><a href="${url}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;border-radius:999px;padding:10px 14px;font-weight:800;">Open Everyone Loses</a></p>
        <p style="margin:18px 0 0;color:#6b7280;font-size:12px;">You are receiving this because email bet notifications are enabled in your profile.</p>
      </div>
    `,
    text: `${bettorName} placed ${amount} on ${pick} for ${eventTitle} (${league}, ${time}). Open Everyone Loses: ${url}`
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
    const { recipients = [], bettor = {}, event = {}, bet = {} } = req.body || {};

    const cleanRecipients = Array.isArray(recipients)
      ? recipients.filter(item => item?.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(item.email)))
      : [];

    if (!cleanRecipients.length) return json(res, 200, { sent: 0, skipped: true, reason: "No opted-in recipients." });
    if (!apiKey) return json(res, 200, { sent: 0, skipped: true, reason: "RESEND_API_KEY is not configured in Vercel." });

    const results = [];
    for (const recipient of cleanRecipients.slice(0, 20)) {
      const email = buildEmail({ recipient, bettor, event, bet, appUrl: appUrl ? `https://${String(appUrl).replace(/^https?:\/\//, "")}` : "" });
      try {
        const result = await sendWithResend(email, from, apiKey);
        results.push({ email: recipient.email, ok: true, id: result?.id || "" });
      } catch (error) {
        results.push({ email: recipient.email, ok: false, error: error.message || "Send failed" });
      }
    }

    return json(res, 200, {
      sent: results.filter(item => item.ok).length,
      failed: results.filter(item => !item.ok).length,
      results
    });
  } catch (error) {
    return json(res, 200, { sent: 0, skipped: true, reason: error.message || "Notification failed." });
  }
}
