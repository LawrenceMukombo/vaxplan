import { eq } from "drizzle-orm";
import { db } from "../db";
import { tenants, type Tenant } from "@shared/schema";

/**
 * Shared email transport for app notifications (supervision digest today,
 * approval notices / signup invites / password resets tomorrow).
 *
 * Transport precedence:
 *   1. SendGrid HTTP API   — if SENDGRID_API_KEY is set
 *   2. Generic SMTP        — if SMTP_HOST is set (uses dynamic `nodemailer`
 *                            import; the package is optional)
 *   3. Console fallback    — logs the message so dev/test environments still
 *                            see what *would* have been sent
 *
 * "From" address precedence:
 *   1. tenant.settings.email.fromAddress (per-tenant override, set by an
 *      operator in tenant settings)
 *   2. MAIL_FROM env var                  (platform default)
 *   3. "no-reply@vaxplan.app"             (last-resort default)
 *
 * Reply-to follows the same lookup against tenant.settings.email.replyTo /
 * MAIL_REPLY_TO and is omitted when neither is configured.
 */

export interface TenantEmailSettings {
  /** Verified sender address — must align with the tenant's SPF/DKIM. */
  fromAddress?: string;
  /** Friendly name for the From: header, e.g. "VaxPlan Zambia". */
  fromName?: string;
  /** Optional Reply-To address (defaults to none). */
  replyTo?: string;
}

export type MailerChannel = "console" | "smtp" | "sendgrid";

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Tenant the message is being sent on behalf of. Either `tenant` or
   *  `tenantId` should be supplied; if neither is given, platform defaults
   *  are used. */
  tenant?: Tenant;
  tenantId?: string;
  /** Optional override (rare — most callers should let the resolver decide). */
  fromOverride?: { address: string; name?: string };
}

export interface SendEmailResult {
  ok: boolean;
  channel: MailerChannel;
  detail?: string;
}

function readTenantEmailSettings(tenant: Tenant | undefined): TenantEmailSettings {
  if (!tenant) return {};
  const settings = (tenant.settings ?? {}) as Record<string, unknown>;
  const email = (settings.email ?? {}) as Record<string, unknown>;
  const out: TenantEmailSettings = {};
  if (typeof email.fromAddress === "string" && email.fromAddress.trim()) {
    out.fromAddress = email.fromAddress.trim();
  }
  if (typeof email.fromName === "string" && email.fromName.trim()) {
    out.fromName = email.fromName.trim();
  }
  if (typeof email.replyTo === "string" && email.replyTo.trim()) {
    out.replyTo = email.replyTo.trim();
  }
  return out;
}

async function loadTenant(input: SendEmailInput): Promise<Tenant | undefined> {
  if (input.tenant) return input.tenant;
  if (!input.tenantId) return undefined;
  const [row] = await db.select().from(tenants).where(eq(tenants.id, input.tenantId));
  return row ?? undefined;
}

export interface ResolvedSender {
  address: string;
  name?: string;
  replyTo?: string;
}

function cleanEnv(val?: string | null): string {
  if (!val) return "";
  return String(val).trim().replace(/^['"]|['"]$/g, "");
}

function parseEmailString(raw?: string | null): { address?: string; name?: string } {
  if (!raw) return {};
  const cleaned = cleanEnv(raw);
  if (!cleaned) return {};
  const match = cleaned.match(/^(?:["']?([^"']+)["']?\s+)?<([^>]+)>$/);
  if (match) {
    return { name: match[1]?.trim() || undefined, address: match[2]?.trim() };
  }
  if (cleaned.includes("@")) {
    return { address: cleaned };
  }
  return {};
}

export function resolveSender(
  tenant: Tenant | undefined,
  override?: { address: string; name?: string },
): ResolvedSender {
  if (override?.address) {
    return { address: override.address, name: override.name };
  }
  const tenantEmail = readTenantEmailSettings(tenant);

  // Parse candidate sources in priority order:
  // 1. tenant settings (fromAddress)
  // 2. MAIL_FROM
  // 3. SMTP_FROM
  // 4. SMTP_USER
  // 5. SUPERVISION_DIGEST_FROM (legacy)
  const candidateList = [
    tenantEmail.fromAddress,
    process.env.MAIL_FROM,
    process.env.SMTP_FROM,
    process.env.SMTP_USER,
    process.env.SUPERVISION_DIGEST_FROM,
  ];

  let parsed: { address?: string; name?: string } = {};
  for (const candidate of candidateList) {
    const res = parseEmailString(candidate);
    if (res.address) {
      parsed = res;
      break;
    }
  }

  const address = parsed.address || "noreply@vaxplan.org";
  const name =
    tenantEmail.fromName ||
    parsed.name ||
    cleanEnv(process.env.MAIL_FROM_NAME) ||
    tenant?.name ||
    "VaxPlan Notifications";

  const replyTo =
    tenantEmail.replyTo ||
    cleanEnv(process.env.MAIL_REPLY_TO) ||
    undefined;

  return { address, name, replyTo };
}

function formatAddress(addr: string, name?: string): string {
  if (!name) return addr;
  // Escape quotes in display name.
  const safeName = name.replace(/"/g, '\\"');
  return `"${safeName}" <${addr}>`;
}

async function sendViaSendgrid(
  input: SendEmailInput,
  sender: ResolvedSender,
): Promise<SendEmailResult> {
  const apiKey = cleanEnv(process.env.SENDGRID_API_KEY);
  const content: Array<{ type: string; value: string }> = [
    { type: "text/plain", value: input.text },
  ];
  if (input.html) content.push({ type: "text/html", value: input.html });
  const payload: Record<string, unknown> = {
    personalizations: [{ to: [{ email: input.to.trim() }] }],
    from: sender.name
      ? { email: sender.address, name: sender.name }
      : { email: sender.address },
    subject: input.subject,
    content,
  };
  if (sender.replyTo) payload.reply_to = { email: sender.replyTo };
  try {
    const resp = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (resp.ok) {
      console.log(`[mailer] Email sent successfully to ${input.to} via SendGrid: "${input.subject}"`);
      return { ok: true, channel: "sendgrid" };
    }
    const body = await resp.text().catch(() => "");
    const detail = `sendgrid http ${resp.status}${body ? `: ${body.slice(0, 200)}` : ""}`;
    console.error(`[mailer] SendGrid delivery to ${input.to} failed: ${detail}`);
    return {
      ok: false,
      channel: "sendgrid",
      detail,
    };
  } catch (err: any) {
    const detail = err?.message ?? String(err);
    console.error(`[mailer] SendGrid delivery to ${input.to} encountered error: ${detail}`);
    return { ok: false, channel: "sendgrid", detail };
  }
}

async function sendViaSmtp(
  input: SendEmailInput,
  sender: ResolvedSender,
): Promise<SendEmailResult> {
  let nodemailer: any;
  try {
    // Optional dependency — only required when SMTP_HOST is configured.
    const mod: any = await import("nodemailer");
    nodemailer = mod.default ?? mod;
  } catch (err: any) {
    const detail =
      "SMTP_HOST is set but the `nodemailer` package is not available. " +
      "Run `npm install nodemailer` or unset SMTP_HOST to fall back to console.";
    console.error(`[mailer] ${detail}`);
    return {
      ok: false,
      channel: "smtp",
      detail,
    };
  }

  const host = cleanEnv(process.env.SMTP_HOST || "");
  const port = parseInt(cleanEnv(process.env.SMTP_PORT || "587"), 10) || 587;
  const secure =
    typeof process.env.SMTP_SECURE === "string"
      ? cleanEnv(process.env.SMTP_SECURE) === "true" || cleanEnv(process.env.SMTP_SECURE) === "1"
      : port === 465;

  const rawUser = cleanEnv(process.env.SMTP_USER || "");
  const user = rawUser.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "");
  const rawPass = cleanEnv(process.env.SMTP_PASSWORD || process.env.SMTP_PASS || "");
  const pass = rawPass.replace(/[\s\u00A0\u200B-\u200D\uFEFF]/g, "");

  const auth = user && pass ? { user, pass } : undefined;

  const fromFormatted = formatAddress(sender.address, sender.name);
  const mailOptions = {
    from: fromFormatted,
    to: input.to.trim(),
    subject: input.subject,
    text: input.text,
    html: input.html,
    replyTo: sender.replyTo,
  };

  const isGmail = host.toLowerCase().includes("gmail") || user.toLowerCase().endsWith("@gmail.com");

  try {
    const transport = isGmail
      ? nodemailer.createTransport({
          service: "gmail",
          auth,
          tls: { rejectUnauthorized: false },
          connectionTimeout: 20000,
          greetingTimeout: 20000,
          socketTimeout: 30000,
        })
      : nodemailer.createTransport({
          host,
          port,
          secure,
          auth,
          tls: { rejectUnauthorized: false },
          connectionTimeout: 20000,
          greetingTimeout: 20000,
          socketTimeout: 30000,
        });

    const info = await transport.sendMail(mailOptions);
    console.log(
      `[mailer] Email sent successfully to ${input.to} via SMTP (${host}:${port}): "${input.subject}" [msgId: ${info?.messageId || "ok"}]`
    );
    return { ok: true, channel: "smtp", detail: info?.messageId };
  } catch (primaryErr: any) {
    const primaryMsg = primaryErr?.message ?? String(primaryErr);
    console.warn(`[mailer] Primary SMTP delivery to ${input.to} (${host}:${port}) failed: ${primaryMsg}`);

    // If port 465 timed out or network error, attempt fallback to port 587 (or vice-versa)
    const isNetworkOrTimeout =
      primaryErr?.code === "ETIMEDOUT" ||
      primaryErr?.code === "ESOCKET" ||
      primaryErr?.code === "ECONNREFUSED" ||
      primaryErr?.code === "ECONNRESET";

    if (isNetworkOrTimeout && (port === 465 || port === 587)) {
      const fallbackPort = port === 465 ? 587 : 465;
      const fallbackSecure = fallbackPort === 465;
      console.log(`[mailer] Attempting fallback to ${host}:${fallbackPort}...`);
      try {
        const fallbackTransport = nodemailer.createTransport({
          host,
          port: fallbackPort,
          secure: fallbackSecure,
          auth,
          tls: { rejectUnauthorized: false },
          connectionTimeout: 20000,
          greetingTimeout: 20000,
          socketTimeout: 30000,
        });
        const fallbackInfo = await fallbackTransport.sendMail(mailOptions);
        console.log(
          `[mailer] Fallback SMTP email sent successfully to ${input.to} (${host}:${fallbackPort}): "${input.subject}"`
        );
        return { ok: true, channel: "smtp", detail: fallbackInfo?.messageId };
      } catch (fallbackErr: any) {
        const fallbackMsg = fallbackErr?.message ?? String(fallbackErr);
        console.error(`[mailer] Fallback SMTP delivery also failed: ${fallbackMsg}`);
      }
    }

    console.error(`[mailer] Final SMTP failure to ${input.to}: ${primaryMsg}`);
    return { ok: false, channel: "smtp", detail: primaryMsg };
  }
}

function logToConsole(input: SendEmailInput, sender: ResolvedSender): SendEmailResult {
  console.log(
    `[mailer] (console-only delivery — configure SENDGRID_API_KEY or SMTP_HOST to email)\n` +
      `  from: ${formatAddress(sender.address, sender.name)}\n` +
      (sender.replyTo ? `  reply-to: ${sender.replyTo}\n` : "") +
      `  to: ${input.to}\n` +
      `  subject: ${input.subject}\n` +
      `${input.text}\n`,
  );
  return { ok: true, channel: "console" };
}

/**
 * Send an email. Resolves the from-address from per-tenant settings (then
 * platform env, then default), picks a transport based on which provider
 * env vars are set, and returns a structured result so callers can log /
 * audit the channel used.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!input.to || !input.to.trim()) {
    console.warn("[mailer] sendEmail called without recipient address");
    return { ok: false, channel: "console", detail: "no recipient address" };
  }
  const tenant = await loadTenant(input);
  const sender = resolveSender(tenant, input.fromOverride);

  if (process.env.SENDGRID_API_KEY) {
    const res = await sendViaSendgrid(input, sender);
    if (res.ok) return res;
    console.warn(`[mailer] SendGrid failed (${res.detail}); checking SMTP fallback...`);
    if (process.env.SMTP_HOST) {
      return sendViaSmtp(input, sender);
    }
    return res;
  }
  if (process.env.SMTP_HOST) {
    return sendViaSmtp(input, sender);
  }
  return logToConsole(input, sender);
}

/** Test-only — lets unit tests assert which channel would be used without
 *  actually contacting a provider. */
export function activeChannel(): MailerChannel {
  if (process.env.SENDGRID_API_KEY) return "sendgrid";
  if (process.env.SMTP_HOST) return "smtp";
  return "console";
}
