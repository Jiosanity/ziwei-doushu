'use client';
import { useEffect, useState } from 'react';
import type { ZiweiChart } from '@/lib/ziwei/types';
import { DATASET_TOPICS, type DatasetTopic } from '@/lib/dataset';
import { openPrintableReport } from '@/lib/ziwei/export';
import type { TimeView } from './TimeNav';

function Text({ text }: { text: string }) {
  return <div className="reading-prose">{text.split('\n').map((line, i) => {
    const title = line.match(/^(?:#{1,6}\s+|\*\*【)(.*?)(?:】\*\*)?$/);
    if (title) return <h3 key={i}>{title[1]}</h3>;
    if (!line.trim()) return <div key={i} className="reading-paragraph-gap" />;
    return <p key={i}>{line.split(/(\*\*.*?\*\*)/g).map((part, j) => part.startsWith('**') && part.endsWith('**') ? <strong key={j}>{part.slice(2, -2)}</strong> : part)}</p>;
  })}</div>;
}

function Reading({ text }: { text: string }) {
  const blocks = text.split(/(?=^\*\*【[^\n]+】\*\*\s*$)/m).filter(s => s.trim());
  return <>{blocks.map((block, i) => {
    const match = block.match(/^\*\*【([^\n]+)】\*\*\s*\n?/);
    const title = match?.[1];
    const body = title ? block.slice(match![0].length) : block;
    if (i < 3 || !title) return <section className="reading-section" key={i}>{title && <h3 className="reading-section-title">{title}</h3>}<Text text={body} /></section>;
    return <details className="reading-detail" key={i}><summary>{title}<span aria-hidden="true">＋</span></summary><Text text={body} /></details>;
  })}</>;
}

export default function DatasetPanel({ chart, view }: { chart: ZiweiChart; view: TimeView }) {
  const [topic, setTopic] = useState<DatasetTopic>('overview');
  const [content, setContent] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const birth = chart.birthInfo;
  const mainStar = chart.palaces.find(p => p.isMingGong)?.stars.find(s => s.type === 'major')?.name ?? null;
  useEffect(() => {
    const controller = new AbortController();
    setContent(null); setError(''); setLoading(true); setTopic('overview');
    if (birth.timeUnknown) { setError('出生时辰不详，暂不匹配解读数据。'); setLoading(false); return; }
    fetch('/api/readings', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: birth.year, month: birth.month, day: birth.day, hour: birth.hour, gender: birth.gender, mainStar }), signal: controller.signal,
    }).then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '读取失败');
      if (!controller.signal.aborted) setContent(data.content);
    }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : '读取失败'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [birth.year, birth.month, birth.day, birth.hour, birth.gender, birth.timeUnknown, mainStar, retry]);
  const exportReport = () => {
    if (!content) return;
    const report = `# ${birth.name || '紫微命盘'} · 十三维解读\n\n排盘日期：${birth.year}-${birth.month}-${birth.day} ${'子丑寅卯辰巳午未申酉戌亥'[birth.hour]}时 ${birth.gender === 'male' ? '男' : '女'}\n\n固定版本本命解读，生成于 2026-10-15。文中当前大限等按生成时口径保留。\n\n` + DATASET_TOPICS.map(([key,label]) => `## ${label}\n\n${content[key]}`).join('\n\n---\n\n') + '\n\n来源：紫微斗数开源解读数据集 v4.0，作者：王多鱼AI\nhttps://github.com/Renhuai123/ziwei-doushu/releases/tag/v4.0-13d\n仅供传统文化学习与研究。\n';
    const url = URL.createObjectURL(new Blob([report], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `紫微命盘-${birth.year}-${birth.month}-${birth.day}.md`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const label = DATASET_TOPICS.find(([key]) => key === topic)?.[1];
  const visibleTopics = DATASET_TOPICS;
  return <section className="dataset-reading">
    <div className="reading-topic-bar" aria-label="解读主题">{visibleTopics.map(([key, text]) => <button key={key} type="button" aria-pressed={topic === key} onClick={() => setTopic(key)}>{text === '命格总览' ? '命格' : text}</button>)}</div>
    <div className="reading-heading"><div><p className="reading-kicker">本命解读</p><h2>{label}</h2></div><button type="button" className="toolbar-button reading-export" disabled={!content} onClick={exportReport} title="下载包含十三个主题的 Markdown 报告">↓ Markdown</button><button type="button" className="toolbar-button" disabled={!content} onClick={() => { if(content) { try { openPrintableReport(chart,content); } catch(e) { setError(e instanceof Error ? e.message : "无法打开打印窗口"); } } }}>打印 / PDF</button></div>
    <p className="reading-birth">{birth.year}-{String(birth.month).padStart(2, '0')}-{String(birth.day).padStart(2, '0')} · {'子丑寅卯辰巳午未申酉戌亥'[birth.hour]}时 · {birth.gender === 'male' ? '男' : '女'}{birth.origInput && (birth.origInput.year !== birth.year || birth.origInput.month !== birth.month || birth.origInput.day !== birth.day) ? '（已按校正时间换日）' : ''}</p>
    {view !== 'mingpan' && <p className="reading-notice">当前正在查看运限。以下为本命解读，不随大限或流年切换。</p>}
    {loading && <div className="reading-loading" role="status"><span/>正在读取命盘解读…</div>}
    {error && <div className="reading-error" role="status"><p>{error}</p>{!birth.timeUnknown && <button type="button" onClick={() => setRetry(n => n + 1)}>重新读取</button>}</div>}
    {content && <div className="reading-content" key={topic}><Reading text={content[topic]} /></div>}
    <details className="reading-data-note"><summary>关于解读版本与数据来源</summary><p>数据集 v4.0，2026-10-15 生成。固定版本本命解读，非即时 AI。文中“当前大限”等按生成时口径保留，不代表今天的运势。</p><p>本项目使用了紫微斗数开源解读数据集 v4.0（674,976 张命盘 × 13 维）。作者：王多鱼AI。<a href="https://github.com/Renhuai123/ziwei-doushu/releases/tag/v4.0-13d" target="_blank" rel="noreferrer">数据来源与许可</a>。仅供传统文化学习与研究。</p></details>
  </section>;
}
