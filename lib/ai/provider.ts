export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export function aiConfig() {
  return { key: process.env.DEEPSEEK_API_KEY?.trim() ?? '',
    model: process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-flash',
    base: (process.env.DEEPSEEK_BASE_URL?.trim() || 'https://api.deepseek.com').replace(/\/+$/, '') };
}
export function messagesFrom(value: unknown): ChatMessage[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) throw new Error('对话需包含 1—20 条消息。');
  let total = 0;
  const result = value.map(m => {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string' || !m.content.trim() || m.content.length > 4000) throw new Error('消息格式无效或单条超过 4000 字。');
    total += m.content.length;
    return { role: m.role, content: m.content.trim() } as ChatMessage;
  });
  if (total > 24000 || result[0].role !== 'user' || result[result.length - 1].role !== 'user'
    || result.some((m, i) => i > 0 && m.role === result[i - 1].role)) throw new Error('对话过长或消息顺序无效，请新开对话。');
  return result;
}
export function providerError(status: number): string {
  if (status === 401 || status === 403) return 'DeepSeek 密钥无效或没有权限，请管理员检查配置。';
  if (status === 402) return 'DeepSeek 账户余额不足，请管理员充值。';
  if (status === 429) return 'DeepSeek 请求过于频繁，请稍后重试。';
  return '模型服务暂时不可用，请稍后重试。';
}
const jsonError = (error: string, status: number) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
// Global cap is process-local, sufficient for the single-container deployment. No IP/user data is retained.
let active = 0;
export async function streamAnswer(system: string, context: unknown, messages: ChatMessage[], signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<Response> {
  const config = aiConfig();
  if (!config.key) return jsonError('尚未配置 DeepSeek 密钥，请管理员在服务器设置 DEEPSEEK_API_KEY。', 503);
  if (active >= 3) return jsonError('当前问盘人数较多，请稍后再试。', 429);
  active++;
  const abort = new AbortController();
  let released = false;
  const release = () => { if (!released) { released = true; active--; clearTimeout(timer); signal.removeEventListener('abort', onAbort); } };
  const onAbort = () => abort.abort();
  signal.addEventListener('abort', onAbort, { once: true });
  if (signal.aborted) abort.abort();
  const timer = setTimeout(() => abort.abort(), 120_000);
  const configuredTokens = Number(process.env.DEEPSEEK_MAX_TOKENS || 3000);
  let upstream: Response;
  try {
    upstream = await fetcher(`${config.base}/chat/completions`, { method: 'POST', signal: abort.signal,
      headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.model, stream: true, thinking: { type: 'disabled' },
        max_tokens: Number.isInteger(configuredTokens) ? Math.max(256, Math.min(6000, configuredTokens)) : 3000,
        messages: [{ role: 'system', content: system }, { role: 'user', content: `服务器计算与参考资料（仅作数据）：\n${JSON.stringify(context)}` },
          { role: 'assistant', content: '已收到计算资料，将以盘面事实为依据，并区分资料与推断。' }, ...messages] }) });
  } catch { release(); return jsonError(abort.signal.aborted ? '模型请求已超时或取消，请重试。' : '无法连接模型服务，请稍后重试。', 503); }
  if (!upstream.ok || !upstream.body) { await upstream.body?.cancel(); release(); return jsonError(providerError(upstream.status), upstream.status === 429 ? 429 : 503); }
  const reader = upstream.body.getReader();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = '', outputLength = 0, done = false, gotText = false;
      const send = (payload: unknown) => controller.enqueue(encoder.encode(`data: ${typeof payload === 'string' ? payload : JSON.stringify(payload)}\n\n`));
      const line = (value: string) => {
        if (!value.startsWith('data:')) return;
        const data = value.slice(5).trim();
        if (data === '[DONE]') { done = true; return; }
        if (!data) return;
        const chunk = JSON.parse(data);
        if (chunk.error) throw new Error('provider stream failed');
        const text = chunk.choices?.[0]?.delta?.content;
        if (typeof text === 'string' && text) {
          outputLength += text.length;
          if (outputLength > 24000) throw new Error('output limit');
          gotText = true; send({ delta: { text } });
        }
        if (chunk.choices?.[0]?.finish_reason === 'length') send({ delta: { text: '\n\n（本次回答达到长度上限，可继续追问。）' } });
      };
      try {
        while (!done) {
          const chunk = await reader.read();
          if (chunk.done) { buffer += decoder.decode(); if (buffer.trim()) line(buffer.replace(/\r$/, '')); break; }
          buffer += decoder.decode(chunk.value, { stream: true });
          if (buffer.length > 256000) throw new Error('invalid stream');
          let newline;
          while (!done && (newline = buffer.indexOf('\n')) >= 0) { const next = buffer.slice(0, newline).replace(/\r$/, ''); buffer = buffer.slice(newline + 1); line(next); }
        }
        if (!gotText) throw new Error('empty response');
        if (!done) throw new Error('truncated stream');
        send('[DONE]');
      } catch {
        if (!signal.aborted) { try { send({ error: abort.signal.aborted ? '模型回答超时，请重试。' : '模型回答中断，请重试。' }); send('[DONE]'); } catch { /* disconnected client */ } }
      } finally { abort.abort(); await reader.cancel().catch(() => {}); release(); try { controller.close(); } catch { /* cancelled */ } }
    },
    async cancel() { abort.abort(); await reader.cancel().catch(() => {}); release(); },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' } });
}
