/** Consume the server's SSE protocol without assuming network chunk boundaries. */
export async function readAiStream(response: Response, onTextDelta: (text: string) => void, signal?: AbortSignal): Promise<void> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `请求失败（${response.status}）`);
  }
  if (!response.body) throw new Error('服务器未返回解读内容');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completed = false;
  const consume = (event: string) => {
    const data = event.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    if (!data || completed) return;
    if (data.trim() === '[DONE]') { completed = true; return; }
    let parsed;
    try { parsed = JSON.parse(data); } catch { throw new Error('解读数据格式异常，请重试'); }
    if (parsed.error) throw new Error(String(parsed.error));
    if (typeof parsed.delta?.text === 'string') onTextDelta(parsed.delta.text);
  };
  try {
    while (!completed) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      // Normalize after buffering so even CR/LF split across chunks is preserved.
      buffer = buffer.replace(/\r\n/g, '\n');
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        consume(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
      }
      if (done) {
        if (buffer.trim()) consume(buffer);
        break;
      }
    }
    if (!completed) throw new Error('连接提前结束，回答尚未完成');
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/** Keep complete user/assistant pairs within the server's context budget. */
export function boundedAiMessages(messages: {role:'user'|'assistant';content:string}[]) {
  const result = messages.filter(m => m.content.trim()).slice(-15).map(m => ({role:m.role,content:m.content.slice(0,4000)}));
  while (result.length && result[0].role !== 'user') result.shift();
  while (result.length > 1 && result.reduce((sum,m) => sum + m.content.length,0) > 24000) result.splice(0,2);
  return result;
}
