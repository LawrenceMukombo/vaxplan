/** Dedicated transport: never enters the legacy mutation outbox with an unsupported entity. */
export async function planningRequest<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method, credentials: "include", headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Planning request failed");
  return result as T;
}
