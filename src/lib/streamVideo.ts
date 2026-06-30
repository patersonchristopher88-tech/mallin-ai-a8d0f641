export type VideoStreamEvent =
  | { type: "status"; status: string; position?: number; log?: string; requestId?: string }
  | { type: "final"; url: string; generationId: string | null; prompt: string }
  | { type: "error"; message: string };

export async function streamVideo(
  body: Record<string, unknown>,
  token: string | null,
  onEvent: (evt: VideoStreamEvent) => void,
  signal?: AbortSignal,
) {
  const res = await fetch("/api/generate-video", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) throw new Error((await res.text()) || `HTTP ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const l = line.trim();
      if (!l.startsWith("data:")) continue;
      try {
        onEvent(JSON.parse(l.slice(5).trim()) as VideoStreamEvent);
      } catch {
        /* ignore */
      }
    }
  }
}
