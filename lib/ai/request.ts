import { InputError } from './context';
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  // Browsers may otherwise submit cross-origin text/plain requests against a LAN server.
  const origin = request.headers.get('origin');
  if (origin) {
    let originHost: string;
    try { originHost = new URL(origin).host; } catch { throw new InputError('请求来源无效。'); }
    if (originHost !== request.headers.get('host') && originHost !== new URL(request.url).host) {
      throw new InputError('请从本站页面发起问盘。');
    }
  }
  const length = Number(request.headers.get('content-length'));
  if (length > 100000) throw new InputError('请求内容过大。');
  const reader = request.body?.getReader();
  if (!reader) throw new InputError('请求格式错误。');
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 100000) { await reader.cancel(); throw new InputError('请求内容过大。'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const body = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch (error) { throw error instanceof InputError ? error : new InputError('请求格式错误。'); }
  finally { reader.releaseLock(); }
}
export function inputFailure(error: unknown) {
  return Response.json({ error: error instanceof InputError ? error.message : '命盘参数无效，请重新排盘后重试。' },
    { status: 400, headers: { 'Cache-Control': 'no-store' } });
}
