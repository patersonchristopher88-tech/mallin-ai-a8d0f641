/**
 * Client helper that consumes the SSE stream from /api/generate-image
 * and yields data URLs (partial + final). `onFrame(url, isFinal)`.
 */
export async function streamImage(
  endpoint: string,
  body: Record<string, unknown>,
  token: string | null,
  onFrame: (dataUrl: string, isFinal: boolean) => void,
  signal?: AbortSignal,
) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error((await res.text()) || `HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let lastB64: string | null = null;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const l = line.trim();
      if (!l.startsWith("data:")) continue;
      const payload = l.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload) as {
          type?: string;
          b64_json?: string;
          data?: Array<{ b64_json?: string }>;
        };
        const b64 = evt.b64_json ?? evt.data?.[0]?.b64_json ?? null;
        if (!b64) continue;
        lastB64 = b64;
        const isFinal =
          (evt.type ?? "").includes("completed") ||
          (evt.type ?? "") === "image.generation";
        // flushSync-style: hand back immediately for blur-up effect
        onFrame(`data:image/png;base64,${b64}`, isFinal);
      } catch {
        /* ignore */
      }
    }
  }
  if (lastB64) onFrame(`data:image/png;base64,${lastB64}`, true);
}
