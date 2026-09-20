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
const REQUEST_TIMEOUT_MS = 3500;

// Cache generated JWT tokens per serverUrl:session:secretKey
const tokenCache = new Map<string, string>();

export function clearWppconnectTokenCache() {
  tokenCache.clear();
}

function resolveConfig(config?: WppconnectConfig) {
  const serverUrl = (config?.serverUrl || process.env.WPPCONNECT_SERVER_URL || DEFAULT_SERVER_URL).replace(/\/+$/, "");
  const session = (config?.session || process.env.WPPCONNECT_SESSION || DEFAULT_SESSION).trim();
  const secretKey = (config?.secretKey || process.env.WPPCONNECT_SECRET_KEY || "THISISMYSECURETOKEN").trim();
  return { serverUrl, session, secretKey };
}

/**
 * Acquire JWT session token from WPPConnect server if required
 */
export async function getWppconnectAuthToken(serverUrl: string, session: string, secretKey?: string): Promise<string> {
  const effectiveSecret = secretKey?.trim() || "THISISMYSECURETOKEN";
  const cacheKey = `${serverUrl}:${session}:${effectiveSecret}`;
  if (tokenCache.has(cacheKey)) {
    return tokenCache.get(cacheKey)!;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const url = `${serverUrl}/api/${session}/${encodeURIComponent(effectiveSecret)}/generate-token`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data: any = await res.json();
      const token = data?.token || data?.session?.token;
      if (token) {
        tokenCache.set(cacheKey, token);
        return token;
      }
    }
  } catch {
    // If generate-token fails, fallback to passing secret directly
  }

  return effectiveSecret;
}

async function getHeaders(serverUrl: string, session: string, secretKey?: string): Promise<Record<string, string>> {
  const token = await getWppconnectAuthToken(serverUrl, session, secretKey);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    headers["x-secret-key"] = secretKey?.trim() || "THISISMYSECURETOKEN";
  }
  return headers;
}

/**
 * Format phone number to clean digits with country code for WhatsApp (e.g., 27821234567)
 */
export function sanitizeWhatsAppPhone(phone: string): string {
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
    const headers = await getHeaders(serverUrl, session, secretKey);
    let res = await fetch(`${serverUrl}/api/${session}/status-session`, {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    // If GET is 404 or 405, fallback to POST status-session or check-connection-session
    if (res.status === 404 || res.status === 405) {
      try {
        res = await fetch(`${serverUrl}/api/${session}/check-connection-session`, {
          method: "GET",
          headers,
          signal: controller.signal,
        });
      } catch {}
    }

    clearTimeout(timeoutId);

    if (!res.ok) {
      if (res.status === 404) {
        return {
          connected: false,
          status: "DISCONNECTED",
          message: `Session '${session}' not initialized. Click 'Pair Device (Scan QR)' to start.`,
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

    if (rawStatus === "CONNECTED" || rawStatus === "ISLOGGED" || rawStatus === "LOGGEDIN" || rawStatus === "QRREADSUCCESS") {
      return {
        connected: true,
        status: "CONNECTED",
        phone: data?.phone || data?.user || null,
        message: "WhatsApp Gateway is connected and ready.",
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

    if (rawStatus === "INITIALIZING" || rawStatus === "STARTING") {
      return {
        connected: false,
        status: "INITIALIZING",
        message: "WPPConnect instance is initializing...",
      };
    }

    return {
      connected: false,
      status: "DISCONNECTED",
      message: `Gateway status: ${rawStatus || "Disconnected"}.`,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    return {
      connected: false,
      status: "OFFLINE",
      message: `Cannot reach WPPConnect server at ${serverUrl}. Ensure the container is running.`,
    };
  }
}

/**
 * Start session and request QR code
 */
export async function startWppconnectSession(config?: WppconnectConfig): Promise<WppSessionStatus> {
  const { serverUrl, session, secretKey } = resolveConfig(config);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const headers = await getHeaders(serverUrl, session, secretKey);
    const url = `${serverUrl}/api/${session}/start-session`;
    const res = await fetch(url, {
      method: "POST",
      headers,
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

    if (rawStatus === "CONNECTED" || rawStatus === "ISLOGGED" || rawStatus === "LOGGEDIN") {
      return {
        connected: true,
        status: "CONNECTED",
        message: "Session is already connected.",
      };
    }

    let qrcode = data?.qrcode || null;
    if (!qrcode) {
      // Attempt quick secondary fetch for QR code if not in start response
      const qrRes = await getWppconnectQrCode(config);
      qrcode = qrRes.qrcode;
    }

    return {
      connected: false,
      status: "QRCODE",
      qrcode,
      message: qrcode ? "Scan the QR code to complete pairing." : "Initializing QR code...",
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
    const headers = await getHeaders(serverUrl, session, secretKey);
    const url = `${serverUrl}/api/${session}/qrcode-session`;
    const res = await fetch(url, {
      method: "GET",
      headers,
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
    const headers = await getHeaders(serverUrl, session, secretKey);
    const url = `${serverUrl}/api/${session}/send-message`;
    const res = await fetch(url, {
      method: "POST",
      headers,
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
    const headers = await getHeaders(serverUrl, session, secretKey);
    const url = `${serverUrl}/api/${session}/close-session`;
    const res = await fetch(url, {
      method: "POST",
      headers,
    });
    return { success: res.ok, message: res.ok ? "Session closed successfully" : `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
