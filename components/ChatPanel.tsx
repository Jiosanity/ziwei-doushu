'use client';
import { Fragment, useEffect, useRef, useState } from 'react';
import type { ZiweiChart } from '@/lib/ziwei/types';
import type { TimeView } from './TimeNav';
import { readAiStream, boundedAiMessages } from '@/lib/ai-client-stream';
import './ai-chat.css';

type Message = { role: 'user' | 'assistant'; content: string; interrupted?: boolean };
type Props = { chart: ZiweiChart; view?: TimeView; year?: number; selectedDaXianIndex?: number };
const STORAGE = 'ziwei-ai-conversations-v1';
const MAX_MESSAGES = 16;
function loadHistory(key: string): Message[] {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE) || '{}')[key];
    if (!Array.isArray(stored)) return [];
    return stored.filter(m => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string').slice(-MAX_MESSAGES).map(m => ({ role: m.role, content: m.content.slice(0, 24000), interrupted: !!m.interrupted }));
  } catch { return []; }
}
function saveHistory(key: string, messages: Message[]) {
  try {
    const old = JSON.parse(localStorage.getItem(STORAGE) || '{}');
    const entries = Object.entries(old).filter(([k]) => k !== key).slice(-5);
    localStorage.setItem(STORAGE, JSON.stringify({ ...Object.fromEntries(entries), [key]: messages.slice(-MAX_MESSAGES) }));
  } catch { /* Private browsing or storage quota: the current conversation still works. */ }
}
function RichText({ text }: { text: string }) {
  return <>{text.split('\n').map((line, i) => {
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    const content = (heading ? heading[2] : line).split(/(\*\*[^*]+\*\*)/g).map((part, j) => part.startsWith('**') ? <strong key={j}>{part.slice(2, -2)}</strong> : <Fragment key={j}>{part}</Fragment>);
    return heading ? <h4 key={i}>{content}</h4> : <div className="ai-text-line" key={i}>{content.length ? content : '\u00a0'}</div>;
  })}</>;
}
export default function ChatPanel(props: Props) {
  const contextKey = JSON.stringify([props.chart.birthInfo, props.chart.lunarInfo, props.chart.mingGongBranch, props.chart.wuxingJu, props.view || 'mingpan', props.year, props.selectedDaXianIndex]);
  return <Conversation key={contextKey} {...props} contextKey={contextKey} />;
}
function Conversation({ chart, view = 'mingpan', year, selectedDaXianIndex, contextKey }: Props & { contextKey: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<{ configured: boolean; model: string } | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const scroll = useRef<HTMLDivElement>(null);
  const history = useRef<Message[]>([]);
  const ready = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const restored = loadHistory(contextKey);
    history.current = restored;
    setMessages(restored);
    ready.current = true;
    const statusController = new AbortController();
    fetch('/api/ai/status', { signal: statusController.signal, cache: 'no-store' }).then(async r => {
      if (!r.ok) throw new Error();
      const data = await r.json();
      if (typeof data.configured !== 'boolean') throw new Error();
      if (mounted.current) setStatus(data);
    }).catch(() => { if (!statusController.signal.aborted && mounted.current) setStatusError(true); });
    return () => { mounted.current = false; controller.current?.abort(); statusController.abort(); };
  }, [contextKey]);
  const update = (next: Message[]) => {
    history.current = next.slice(-MAX_MESSAGES);
    if (ready.current) saveHistory(contextKey, history.current);
    if (mounted.current) setMessages(history.current);
  };
  useEffect(() => { scroll.current?.scrollTo({ top: scroll.current.scrollHeight }); }, [messages, loading]);
  const run = async (conversation: Message[]) => {
    if (controller.current || !status?.configured) return;
    const request = new AbortController();
    controller.current = request;
    setLoading(true); setError(''); setInput('');
    const base = conversation.filter(message => message.content.trim()).slice(-(MAX_MESSAGES - 1));
    let text = '';
    update([...base, { role: 'assistant', content: '', interrupted: true }]);
    try {
      const response = await fetch('/api/interpret', {
        method: 'POST', signal: request.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chart, view, year, selectedDaXianIndex, messages: boundedAiMessages(base) }),
      });
      await readAiStream(response, delta => { text += delta; update([...base, { role: 'assistant', content: text, interrupted: true }]); }, request.signal);
      if (!text.trim()) throw new Error('模型未返回回答，请重试');
      update([...base, { role: 'assistant', content: text }]);
    } catch (e) {
      update([...base, { role: 'assistant', content: text, interrupted: true }]);
      if (mounted.current) setError(request.signal.aborted ? '已停止生成，可继续或重新回答。' : e instanceof Error ? e.message : '解读失败，请重试');
    } finally {
      controller.current = null;
      if (mounted.current) setLoading(false);
    }
  };
  const send = (text: string) => { if (text.trim() && text.length <= 2000) void run([...history.current, { role: 'user', content: text.trim() }]); };
  const last = messages[messages.length - 1];
  const suggestions = view === 'liunian' ? [`${year || '今年'}年的重点是什么？`, '今年事业与财运如何？', '这一年有哪些关系变化？'] : view === 'daxian' ? ['这步大限的重点是什么？', '这十年事业如何发展？', '这步大限与本命如何配合？'] : ['分析我的命格与性格', '事业与财运适合什么方向？', '感情与婚姻有哪些特点？', '请解释命盘中的四化'];
  return <section className="ai-chat" aria-label="AI 问盘">
    <header className="ai-chat-header"><div><span className="ai-eyebrow">AI CONSULTATION</span><h2>与命盘对话</h2></div><button type="button" disabled={loading || !messages.length} onClick={() => { update([]); setError(''); }}>清空对话</button></header>
    <div className="ai-context">{view === 'mingpan' ? '本命盘' : view === 'daxian' ? '当前所选大限' : `${year || ''} 流年`} · {status?.configured ? status.model : 'DeepSeek'}</div>
    {!status?.configured && <p className="ai-service" role="status">{statusError ? '暂时无法确认 AI 服务状态，请刷新后重试。' : status ? 'AI 服务尚未配置密钥，配置完成后即可提问。' : '正在确认 AI 服务状态…'}</p>}
    <div className="ai-messages" ref={scroll} aria-live="polite" aria-busy={loading}>
      {!messages.length && <div className="ai-empty"><span>✳</span><h3>从你关心的事开始</h3><p>结合当前命盘、运限与十三维解读，逐步展开。</p><div className="ai-suggestions">{suggestions.map(q => <button type="button" key={q} disabled={!status?.configured || loading} onClick={() => send(q)}>{q}<span>↗</span></button>)}</div></div>}
      {messages.map((message, index) => <article key={index} className={`ai-message ai-message-${message.role}`}><div className="ai-message-role">{message.role === 'user' ? '你' : 'AI 解读'}</div><RichText text={message.content || (loading && index === messages.length - 1 ? '正在思考…' : '尚未生成回答')} />{message.interrupted && !(loading && index === messages.length - 1) && <small>回答未完成</small>}</article>)}
    </div>
    {error && <p className="ai-error" role="alert">{error}</p>}
    {!loading && last?.role === 'assistant' && <div className="ai-actions"><button type="button" disabled={!status?.configured} onClick={() => void run(messages.slice(0, -1))}>重新回答</button>{last.interrupted && last.content && <button type="button" disabled={!status?.configured} onClick={() => send('请从上次中断处继续回答，不要重复已有内容。')}>继续回答</button>}</div>}
    <form className="ai-composer" onSubmit={event => { event.preventDefault(); send(input); }}><textarea aria-label="向命盘提问" maxLength={2000} rows={3} value={input} disabled={loading || !status?.configured} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(input); } }} placeholder="写下你想了解的问题…" /><div><span>{input.length}/2000 · Shift + Enter 换行</span>{loading ? <button type="button" onClick={() => controller.current?.abort()}>停止生成</button> : <button type="submit" disabled={!status?.configured || !input.trim()}>发送 ↗</button>}</div></form>
    <p className="ai-footnote">仅在发送问题时，将当前命盘、相关解读及本轮对话发送给所配置的模型。对话保存在此浏览器，可随时清空。</p>
  </section>;
}
