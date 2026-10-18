import assert from 'node:assert/strict';
import { readAiStream, boundedAiMessages } from '../../lib/ai-client-stream';
async function main() {
 const bytes = new TextEncoder().encode('data: {"delta":{"text":"命盘解读"}}\r\n\r\ndata: [DONE]\r\n\r\n');
 let text='';
 await readAiStream(new Response(new ReadableStream({start(c){for(const byte of bytes)c.enqueue(new Uint8Array([byte]));c.close();}})),delta=>text+=delta);
 assert.equal(text,'命盘解读');
 await assert.rejects(readAiStream(new Response('data: {"delta":{"text":"部分"}}\n\n'),()=>{}),/提前结束/);
 await assert.rejects(readAiStream(new Response('data: {"error":"服务中断"}\n\n'),()=>{}),/服务中断/);
 await assert.rejects(readAiStream(Response.json({error:'未配置密钥'},{status:503}),()=>{}),/未配置密钥/);
 const history=Array.from({length:19},(_,i)=>({role:(i%2?'assistant':'user') as 'user'|'assistant',content:'字'.repeat(6000)}));
 const bounded=boundedAiMessages(history);
 assert.equal(bounded[0].role,'user');assert.equal(bounded.at(-1)?.role,'user');assert(bounded.every(m=>m.content.length<=4000));assert(bounded.reduce((s,m)=>s+m.content.length,0)<=24000);
 console.log('AI client stream and context budget passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
