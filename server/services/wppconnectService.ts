/**
 * WPPConnect Open-Source WhatsApp Gateway Service
 * 
 * Interacts with a self-hosted WPPConnect Server (Docker or PM2).
 * Provides 100% free, subscription-free WhatsApp messaging for VaxPlan.
 */

export interface WppconnectConfig {
  serverUrl?: string;
  session?: string;
  secretKey?: string;
}

export interface WppSessionStatus {
  connected: boolean;
  status: "CONNECTED" | "QRCODE" | "DISCONNECTED" | "OFFLINE" | "INITIALIZING" | "UNKNOWN";
  qrcode?: string | null;
  message?: string;
  phone?: string | null;
}

const DEFAULT_SERVER_URL = "http://localhost:21465";
const DEFAULT_SESSION = "vaxplan";
const REQUEST_TIMEOUT_MS = 8000;

function resolveConfig(config?: WppconnectConfig) {
  const serverUrl = (config?.serverUrl || process.env.WPPCONNECT_SERVER_URL || DEFAULT_SERVER_URL).replace(/\/+$/, "");
  const session = (config?.session || process.env.WPPCONNECT_SESSION || DEFAULT_SESSION).trim();
  const secretKey = (config?.secretKey || process.env.WPPCONNECT_SECRET_KEY || "").trim();
  return { serverUrl, session, secretKey };
}

function getHeaders(secretKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
  if (secretKey) {
    headers["Authorization"] = `Bearer ${secretKey}`;
    headers["x-secret-key"] = secretKey;
  }
  return headers;
}

/**
 * Format phone number to clean digits with country code for WhatsApp (e.g., 27821234567)
 */
export function sanitizeWhatsAppPhone(phone: string): string {
  // Strip all non-digits except +
  let cleaned = phone.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.substring(1);
  }
  return cleaned;
}

/**
 * Query current session status from WPPConnect server
 */
export async function getWppconnectStatus(config?: WppconnectConfig): Promise<WppSessionStatus> {
  const { serverUrl, session, secretKey } = resolveConfig(config);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const url = `${serverUrl}/api/${session}/status-session`;
    const res = await fetch(url, {
      method: "GET",
      headers: getHeaders(secretKey),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      if (res.status === 404) {
        return {
          connected: false,
          status: "DISCONNECTED",
          message: `Session '${session}' not initialized. Click 'Start & Pair' to generate a QR code.`,
        };
      }
      const errText = await res.text();
      return {
        connected: false,
        status: "UNKNOWN",
        message: `WPPConnect returned HTTP ${res.status}: ${errText.slice(0, 150)}`,
      };
    }

    const data: any = await res.json();
    const rawStatus = String(data?.status || data?.state || "").toUpperCase();

    if (rawStatus === "CONNECTED" || rawStatus === "ISLOGGED" || rawStatus === "LOGGEDIN") {
      return {
        connected: true,
        status: "CONNECTED",
        phone: data?.phone || data?.user || null,
        message: "WhatsApp Gateway is connected and active.",
      };
    }

    if (rawStatus === "QRCODE" || rawStatus === "NOTLOGGED" || data?.qrcode) {
      return {
        connected: false,
        status: "QRCODE",
        qrcode: data?.qrcode || null,
        message: "Pairing QR Code ready. Scan with WhatsApp on your phone.",
      };
    }

    return {
      connected: false,
      status: "DISCONNECTED",
      message: `Gateway status: ${rawStatus || "Disconnected"}.`,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      return {
        connected: false,
        status: "OFFLINE",
        message: `Connection timed out reaching WPPConnect at ${serverUrl}. Ensure the service is running.`,
      };
    }
    return {
      connected: false,
      status: "OFFLINE",
      message: `Cannot reach WPPConnect server at ${serverUrl}. Error: ${err.message}`,
    };
  }
}

/**
 * Start session and request QR code
 */
export async function startWppconnectSession(config?: WppconnectConfig): Promise<WppSessionStatus> {
  const { serverUrl, session, secretKey } = resolveConfig(config);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const url = `${serverUrl}/api/${session}/start-session`;
    const res = await fetch(url, {
      method: "POST",
      headers: getHeaders(secretKey),
      body: JSON.stringify({ waitQrCode: true }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      return {
        connected: false,
        status: "UNKNOWN",
        message: `WPPConnect start-session failed (${res.status}): ${errText.slice(0, 150)}`,
      };
    }

    const data: any = await res.json();
    const rawStatus = String(data?.status || "").toUpperCase();

    if (rawStatus === "CONNECTED" || rawStatus === "ISLOGGED") {
      return {
        connected: true,
        status: "CONNECTED",
        message: "Session is already connected.",
      };
    }

    return {
      connected: false,
      status: "QRCODE",
      qrcode: data?.qrcode || null,
      message: "Scan the QR code to complete pairing.",
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    return {
      connected: false,
      status: "OFFLINE",
      message: `Failed to contact WPPConnect at ${serverUrl}: ${err.message}`,
    };
  }
}

/**
 * Fetch fresh QR code
 */
export async function getWppconnectQrCode(config?: WppconnectConfig): Promise<{ qrcode: string | null; message?: string }> {
  const { serverUrl, session, secretKey } = resolveConfig(config);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const url = `${serverUrl}/api/${session}/qrcode-session`;
    const res = await fetch(url, {
      method: "GET",
      headers: getHeaders(secretKey),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return { qrcode: null, message: `Could not retrieve QR code (HTTP ${res.status})` };
    }

    const data: any = await res.json();
    const qrcode = data?.qrcode || data?.data || null;
    return { qrcode, message: qrcode ? "QR Code retrieved successfully" : "No QR code currently active" };
  } catch (err: any) {
    clearTimeout(timeoutId);
    return { qrcode: null, message: err.message };
  }
}

/**
 * Dispatch an automated WhatsApp message via WPPConnect
 */
export async function sendWppconnectMessage(
  to: string,
  message: string,
  config?: WppconnectConfig
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { serverUrl, session, secretKey } = resolveConfig(config);
  const targetPhone = sanitizeWhatsAppPhone(to);

  if (!targetPhone) {
    return { success: false, error: "Invalid recipient phone number." };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const url = `${serverUrl}/api/${session}/send-message`;
    const res = await fetch(url, {
      method: "POST",
      headers: getHeaders(secretKey),
      body: JSON.stringify({
        phone: targetPhone,
        message,
        isGroup: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      let parsedMsg = errText;
      try {
        const jsonErr = JSON.parse(errText);
        parsedMsg = jsonErr.message || jsonErr.error || errText;
      } catch {}
      return {
        success: false,
        error: `WPPConnect HTTP ${res.status}: ${parsedMsg.slice(0, 150)}`,
      };
    }

    const data: any = await res.json();
    const messageId = data?.response?.id || data?.id || `wpp-${Date.now()}`;

    return {
      success: true,
      messageId: String(messageId),
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      return {
        success: false,
        error: `Request timed out reaching WPPConnect at ${serverUrl}. Is the service running?`,
      };
    }
    return {
      success: false,
      error: `WPPConnect connection error: ${err.message}`,
    };
  }
}

/**
 * Log out and disconnect WPPConnect session
 */
export async function closeWppconnectSession(config?: WppconnectConfig): Promise<{ success: boolean; message?: string }> {
  const { serverUrl, session, secretKey } = resolveConfig(config);
  try {
    const url = `${serverUrl}/api/${session}/close-session`;
    const res = await fetch(url, {
      method: "POST",
      headers: getHeaders(secretKey),
    });
    return { success: res.ok, message: res.ok ? "Session closed successfully" : `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
