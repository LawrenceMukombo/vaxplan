/**
 * Android SMS Gateway Service
 *
 * Integrates with the open-source Android SMS Gateway app
 * (https://sms-gate.app / https://github.com/android-sms-gateway/server)
 * which turns an Android phone into a 100% free, self-hosted SMS gateway.
 *
 * The Android app exposes a local HTTP REST API. VaxPlan calls this API to
 * send SMS messages through the SIM card in the device — no paid SMS provider
 * or external API subscription required.
 *
 * Setup:
 *   1. Install the "SMS Gateway for Android" app on any Android phone.
 *   2. Open the app → enable Local Server mode.
 *   3. Note the local IP address and port shown in the app (e.g. http://192.168.1.100:8080).
 *   4. Enter the device URL, username, and password in VaxPlan settings.
 *   5. Optionally set the device as the primary SMS provider for the tenant.
 */

export interface AndroidSmsConfig {
  /** Base URL of the Android SMS Gateway local server, e.g. http://192.168.1.10:8080 */
  serverUrl?: string;
  /** Username shown in the Android app (default: "user") */
  username?: string;
  /** Password shown in the Android app */
  password?: string;
}

export interface AndroidSmsStatus {
  online: boolean;
  deviceName?: string;
  simSlots?: number;
  message?: string;
}

const DEFAULT_SERVER_URL = "http://192.168.1.1:8080";
const REQUEST_TIMEOUT_MS = 5000;

function resolveConfig(config?: AndroidSmsConfig) {
  const serverUrl = (
    config?.serverUrl ||
    process.env.ANDROID_SMS_GATEWAY_URL ||
    DEFAULT_SERVER_URL
  ).replace(/\/+$/, "");
  const username = config?.username || process.env.ANDROID_SMS_GATEWAY_USER || "user";
  const password = config?.password || process.env.ANDROID_SMS_GATEWAY_PASS || "";
  return { serverUrl, username, password };
}

function buildAuthHeader(username: string, password: string): string {
  return "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
}

/**
 * Sanitize phone number to E.164 format (e.g. +260971234567)
 */
export function sanitizeAndroidSmsPhone(phone: string): string {
  let cleaned = phone.trim().replace(/[\s\-().]/g, "");
  if (!cleaned.startsWith("+")) {
    cleaned = "+" + cleaned.replace(/^\+/, "");
  }
  return cleaned;
}

/**
 * Check if Android SMS Gateway device is online and reachable.
 * Calls GET /api/v1/health (or /health, with fallback).
 */
export async function getAndroidSmsStatus(
  config?: AndroidSmsConfig
): Promise<AndroidSmsStatus> {
  if (!config?.serverUrl && !process.env.ANDROID_SMS_GATEWAY_URL) {
    return {
      online: false,
      message: "Android SMS Gateway is not configured.",
    };
  }
  const { serverUrl, username, password } = resolveConfig(config);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: buildAuthHeader(username, password),
    };

    // Try v1 health endpoint first, then root /health
    let res = await fetch(`${serverUrl}/api/v1/health`, {
      headers,
      signal: controller.signal,
    });

    if (!res.ok && res.status === 404) {
      res = await fetch(`${serverUrl}/health`, {
        headers,
        signal: controller.signal,
      });
    }

    clearTimeout(timeoutId);

    if (!res.ok) {
      return {
        online: false,
        message: `Android SMS Gateway returned HTTP ${res.status}. Check URL and credentials.`,
      };
    }

    const data: any = await res.json().catch(() => ({}));
    return {
      online: true,
      deviceName: data?.name || data?.device || data?.deviceName || "Android Device",
      simSlots: data?.simSlots ?? data?.sims ?? undefined,
      message: "Android SMS Gateway is online and ready.",
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === "AbortError";
    return {
      online: false,
      message: isTimeout
        ? `Connection timed out reaching Android SMS Gateway at ${serverUrl}. Ensure the device is on the same network.`
        : `Cannot reach Android SMS Gateway at ${serverUrl}: ${err.message}`,
    };
  }
}

/**
 * Send an SMS via the Android SMS Gateway REST API.
 *
 * API reference: POST /api/v1/message
 * Body: { "message": "...", "phoneNumbers": ["+260..."] }
 */
export async function sendAndroidSms(
  to: string,
  message: string,
  config?: AndroidSmsConfig
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!config?.serverUrl && !process.env.ANDROID_SMS_GATEWAY_URL) {
    return { success: false, error: "Android SMS Gateway is not configured. Please specify a server URL." };
  }
  const { serverUrl, username, password } = resolveConfig(config);
  const phone = sanitizeAndroidSmsPhone(to);

  if (!phone || phone.length < 7) {
    return { success: false, error: "Invalid recipient phone number." };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const url = `${serverUrl}/api/v1/message`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: buildAuthHeader(username, password),
      },
      body: JSON.stringify({
        message,
        phoneNumbers: [phone],
        // Optional: specify SIM slot if multi-SIM device (0 = first SIM)
        // simSlot: 0,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      let errBody = "";
      try {
        const errJson: any = await res.json();
        errBody = errJson.message || errJson.error || JSON.stringify(errJson);
      } catch {
        errBody = await res.text().catch(() => "");
      }
      return {
        success: false,
        error: `Android SMS Gateway HTTP ${res.status}: ${errBody.slice(0, 200)}`,
      };
    }

    const data: any = await res.json().catch(() => ({}));
    // The API returns: { "id": "...", "state": "Pending", ... }
    const messageId = data?.id || data?.messageId || `android-sms-${Date.now()}`;

    const maskedPhone = phone.replace(/(\+?\d{1,4})\d{3,}(\d{2,4})$/, "$1****$2");
    console.log(`[Android SMS] Sent to ${maskedPhone} via ${serverUrl}: id=${messageId}`);
    return { success: true, messageId: String(messageId) };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      return {
        success: false,
        error: `Request timed out reaching Android SMS Gateway at ${serverUrl}. Is the device online and on the same network?`,
      };
    }
    return {
      success: false,
      error: `Android SMS Gateway connection error: ${err.message}`,
    };
  }
}
