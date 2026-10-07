/**
 * Reads a fetch response as JSON but stops past `max` bytes, so a misbehaving
 * upstream cannot make the server buffer an unbounded answer.
 */
export async function jsonCapped<T>(res: Response, max: number): Promise<T> {
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > max) throw new Error(`Upstream answer too large (${declared} bytes)`);
  if (!res.body) return JSON.parse(await res.text()) as T;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      throw new Error(`Upstream answer too large (over ${max} bytes)`);
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(all)) as T;
}
