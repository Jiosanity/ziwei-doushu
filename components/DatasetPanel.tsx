'use client';
import { useEffect, useState } from 'react';
import type { ZiweiChart } from '@/lib/ziwei/types';
import { DATASET_TOPICS, type DatasetTopic } from '@/lib/dataset';
import type { TimeView } from './TimeNav';

function Text({ text }: { text: string }) {
  return <div style={{ lineHeight: 1.9, overflowWrap: 'anywhere' }}>{text.split('\n').map((line, i) => {
    const title = line.match(/^(?:#{1,6}\s+|\*\*【)(.*?)(?:】\*\*)?$/);
    if (title) return <h3 key={i} style={{ margin: '20px 0 8px', color: 'var(--t-gold, #b8922a)' }}>{title[1]}</h3>;
    if (!line.trim()) return <div key={i} style={{ height: 10 }} />;
    return <p key={i} style={{ margin: '4px 0', whiteSpace: 'pre-wrap' }}>{line.split(/(\*\*.*?\*\*)/g).map((part, j) => part.startsWith('**') && part.endsWith('**') ? <strong key={j}>{part.slice(2, -2)}</strong> : part)}</p>;
  })}</div>;
}

export default function DatasetPanel({ chart, view }: { chart: ZiweiChart; view: TimeView }) {
  const [topic, setTopic] = useState<DatasetTopic>('overview');
  const [content, setContent] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
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
  }, [birth.year, birth.month, birth.day, birth.hour, birth.gender, birth.timeUnknown, mainStar]);
  return <section style={{ border: '1px solid var(--border-color, #8884)', borderRadius: 12, padding: 20, minWidth: 0 }}>
    <h2 style={{ fontSize: 19, marginBottom: 8 }}>十三维命盘解读</h2>
    <p style={{ fontSize: 12, marginBottom: 8 }}>匹配排盘日期：{birth.year}-{String(birth.month).padStart(2, '0')}-{String(birth.day).padStart(2, '0')} · {'子丑寅卯辰巳午未申酉戌亥'[birth.hour]}时 · {birth.gender === 'male' ? '男' : '女'}{birth.origInput && (birth.origInput.year !== birth.year || birth.origInput.month !== birth.month || birth.origInput.day !== birth.day) ? '（已按时间校正及子时规则换日）' : ''}</p>
    <p style={{ fontSize: 12, opacity: .7, lineHeight: 1.7 }}>数据集 v4.0 · 2026-10-15 生成 · 固定版本本命解读，非即时 AI。文中“当前大限”等表述按生成时口径保留，不代表今天的运势。</p>
    {view !== 'mingpan' && <p style={{ marginTop: 12 }}>你正在查看运限；以下仍为本命解读，不随大限或流年切换。</p>}
    {loading && <p role="status" style={{ marginTop: 20 }}>正在读取解读…</p>}
    {error && <p role="status" style={{ marginTop: 20 }}>{error}</p>}
    {content && <>
      <div aria-label="解读主题" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '18px 0' }}>{DATASET_TOPICS.map(([key, label]) => <button key={key} type="button" aria-pressed={topic === key} onClick={() => setTopic(key)} style={{ padding: '7px 11px', borderRadius: 8, border: '1px solid #8885', background: topic === key ? '#b8922a' : 'transparent', color: topic === key ? '#fff' : 'inherit', cursor: 'pointer' }}>{label}</button>)}</div>
      <div style={{ maxHeight: '75vh', overflowY: 'auto', paddingRight: 8 }} key={topic}><Text text={content[topic]} /></div>
    </>}
    <p style={{ marginTop: 24, fontSize: 11, opacity: .7, lineHeight: 1.8 }}>本项目使用了紫微斗数开源解读数据集 v4.0（674,976 张命盘 × 13 维）。作者：王多鱼AI。<a href="https://github.com/Renhuai123/ziwei-doushu/releases/tag/v4.0-13d" target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>数据来源与许可</a>。仅供传统文化学习与研究。</p>
  </section>;
}
