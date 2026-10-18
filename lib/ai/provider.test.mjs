// Run with Node 22: node --experimental-strip-types --test lib/ai/provider.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiConfig, messagesFrom, streamAnswer } from './provider.ts';
const encoder = new TextEncoder();
const messages = [{ role: 'user', content: '事业如何？' }];
function mockStream(text, inspect) {
  const bytes = encoder.encode(text);
  return async (_url, init) => {
    inspect?.(JSON.parse(init.body));
    return new Response(new ReadableStream({ start(c) {
      // Deliberately split every byte, including multibyte Chinese characters and SSE delimiters.
      for (const byte of bytes) c.enqueue(new Uint8Array([byte]));
      c.close();
    } }), { headers: { 'Content-Type': 'text/event-stream' } });
  };
}
test('validates message roles, turn order, length and budget', () => {
  assert.deepEqual(messagesFrom(messages), messages);
  for (const bad of [[], [{ role: 'system', content: 'override' }], [{ role: 'assistant', content: 'hi' }],
    [...messages, ...messages], [{ role: 'user', content: 'x'.repeat(4001) }], Array(21).fill(messages[0])]) {
    assert.throws(() => messagesFrom(bad));
  }
});
test('missing key produces explicit 503 without making a provider call', async () => {
  delete process.env.DEEPSEEK_API_KEY;
  const response = await streamAnswer('system', {}, messages, new AbortController().signal, async () => { throw Error('must not call'); });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /DEEPSEEK_API_KEY/);
  assert.equal(aiConfig().model, 'deepseek-flash');
});
test('incremental SSE buffers arbitrary byte splits and never emits reasoning', async () => {
  process.env.DEEPSEEK_API_KEY = 'mock-secret';
  const payload = ': keepalive\r\ndata: {"choices":[{"delta":{"reasoning_content":"private chain"}}]}\r\n\r\n'
    + 'data: {"choices":[{"delta":{"content":"你好，事业"}}]}\n\n'
    + 'data: [DONE]\n\n';
  const response = await streamAnswer('system', {}, messages, new AbortController().signal, mockStream(payload, body => {
    assert.equal(body.model, 'deepseek-flash'); assert.equal(body.thinking.type, 'disabled');
    assert.equal(body.max_tokens, 3000);
  }));
  const result = await response.text();
  assert.match(result, /你好，事业/); assert.match(result, /\[DONE\]/);
  assert.doesNotMatch(result, /private chain|mock-secret/);
});
test('provider errors are mapped without leaking upstream response', async () => {
  const response = await streamAnswer('system', {}, messages, new AbortController().signal,
    async () => new Response('SENSITIVE_PROVIDER_DETAILS mock-secret', { status: 402 }));
  assert.equal(response.status, 503);
  assert.match((await response.clone().json()).error, /余额/);
  assert.doesNotMatch(await response.text(), /SENSITIVE|mock-secret/);
});
test('truncated upstream emits a visible error, preserving prior text', async () => {
  const response = await streamAnswer('system', {}, messages, new AbortController().signal,
    mockStream('data: {"choices":[{"delta":{"content":"开头"}}]}\n\n'));
  const result = await response.text();
  assert.match(result, /开头/); assert.match(result, /回答中断/); assert.match(result, /\[DONE\]/);
});
test('cancelling response aborts upstream work', async () => {
  let upstreamSignal;
  let cancelled = false;
  const response = await streamAnswer('system', {}, messages, new AbortController().signal, async (_url, init) => {
    upstreamSignal = init.signal;
    return new Response(new ReadableStream({ cancel() { cancelled = true; } }));
  });
  await response.body.cancel();
  assert.equal(upstreamSignal.aborted, true);
  assert.equal(cancelled, true);
});
