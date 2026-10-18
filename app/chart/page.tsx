'use client';
import { useEffect, useState } from 'react';
import BirthForm, { type BirthFormState } from '@/components/BirthForm';
import ChartBoard from '@/components/ChartBoard';
import DatasetPanel from '@/components/DatasetPanel';
import { downloadChartPng } from '@/lib/ziwei/export';
import PeriodNavigator from '@/components/PeriodNavigator';
import ChatPanel from '@/components/ChatPanel';
import { CHILDHOOD_DAXIAN_INDEX, getDaXianIndexForYear, getDaXianYears, getChildhoodYears, resolveEffectiveDaXianIndex } from '@/lib/ziwei/yunxian-context';
import SiteHeader, { SettingsButton } from '@/components/SiteHeader';
import TimeNav, { type TimeView } from '@/components/TimeNav';
import { generateChart } from '@/lib/ziwei/algorithm';
import { formToBirthInfo } from '@/lib/ziwei/share';
import { useHistory } from '@/lib/ziwei/history';
import type { BirthInfo, ZiweiChart, Palace, Star } from '@/lib/ziwei/types';
import { BRANCHES } from '@/lib/ziwei/constants';
import Link from 'next/link';

export default function ChartPage() {
  const [chart, setChart] = useState<ZiweiChart | null>(null);
  const [form, setForm] = useState<BirthFormState | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [selectedPalace, setSelectedPalace] = useState<Palace | null>(null);
  const [selectedStar, setSelectedStar] = useState<Star | null>(null);
  const [view, setView] = useState<TimeView>('mingpan');
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedDaXianIndex, setSelectedDaXianIndex] = useState<number | undefined>();
  const [pane, setPane] = useState<'analysis' | 'chat'>('analysis');
  const [expanded, setExpanded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [error, setError] = useState('');
  const { history, save, remove } = useHistory();
  useEffect(() => { document.title = chart ? '紫微命盘 · 命盘分析' : '起紫微命盘 · 紫微斗数'; }, [chart]);
  const cast = (info: BirthInfo, savedForm?: BirthFormState) => {
    try {
      setError(''); setChart(generateChart(info)); setView('mingpan'); setSelectedDaXianIndex(undefined); setYear(new Date().getFullYear()); setSelectedPalace(null); setSelectedStar(null); setPane('analysis');
      if (savedForm || form) save((savedForm || form)!);
    } catch (e) { setError(e instanceof Error ? e.message : '无法生成命盘，请检查出生信息。'); }
  };
  const loadHistory = (value: BirthFormState) => { setForm(value); cast(formToBirthInfo(value), value); setHistoryOpen(false); };
  const edit = () => { setChart(null); setFormKey(k => k + 1); setSelectedPalace(null); setSelectedStar(null); };
  const historyList = <div className="recent-charts"><div className="recent-charts-head"><h2>最近命盘</h2><span>{history.length} 份 · 仅存于本机浏览器</span></div>{history.length ? history.map(entry => <div className="recent-chart" key={entry.id}><button type="button" onClick={() => loadHistory(entry.form)}><strong>{entry.form.name || '未命名命盘'}</strong><span>{entry.form.year}.{entry.form.month}.{entry.form.day} · {entry.form.gender === 'male' ? '男' : '女'} · {entry.form.city || '未填出生地'}</span></button><button type="button" aria-label={`删除${entry.label}`} onClick={() => remove(entry.id)}>×</button></div>) : <p className="empty-note">排盘后会自动保留最近记录。</p>}</div>;
  if (!chart) return <div className="casting-page"><SiteHeader /><main className="casting-layout"><div className="casting-hero"><p className="casting-eyebrow">01 / DESTINY ENGINE</p><h1>起紫微命盘</h1><p className="casting-subtitle">输入出生年月日时</p><div className="casting-rule"/><div className="casting-intro"><p>一张命盘，读懂自己的结构。</p><span>本命 · 大限 · 流年<br/>十三个主题，循着星曜与古籍慢慢研读。</span></div>{historyList}</div><div className="casting-form"><BirthForm key={formKey} initialData={form || undefined} onFormSave={setForm} onSubmit={info => cast(info)} />{error && <p className="form-error" role="alert">{error}</p>}<p className="casting-footnote">传统文化学习与研究 · 解读数据覆盖 1950—2026 年</p></div></main><footer className="site-footer"><Link href="/library">古籍原典</Link><span>·</span><Link href="/knowledge">知识库</Link><span>·</span><a href="https://github.com/Renhuai123/ziwei-doushu" target="_blank" rel="noreferrer">开源项目</a></footer></div>;
  const birth = chart.birthInfo;
  const effectiveIndex = resolveEffectiveDaXianIndex(chart, view, year, selectedDaXianIndex);
  const periodIndex = effectiveIndex < 0 && getChildhoodYears(chart).includes(year) ? CHILDHOOD_DAXIAN_INDEX : effectiveIndex;
  const choosePeriod = (index: number) => {
    const years = index === CHILDHOOD_DAXIAN_INDEX ? getChildhoodYears(chart) : getDaXianYears(chart,index);
    if (!years.length) return;
    setSelectedDaXianIndex(index); if (!years.includes(year)) setYear(years[0]); setView('daxian');
  };
  const chooseYear = (value: number) => {
    if (!Number.isInteger(value) || value < chart.lunarInfo.lunarYear || value > chart.lunarInfo.lunarYear + 150) return;
    const index = getDaXianIndexForYear(chart,value);
    setYear(value); setSelectedDaXianIndex(index < 0 ? CHILDHOOD_DAXIAN_INDEX : index); setView('liunian');
  };
  return <div className="chart-page-root reconstructed-workspace">
    <header className="chart-topbar no-print"><Link href="/" className="workbench-wordmark">ZIWEI</Link><div className="chart-topbar-back-sep"/><button type="button" className="toolbar-button" onClick={edit}>← 重新起盘</button><div className="toolbar-time-nav"><TimeNav chart={chart} view={view} liunianYear={year} onViewChange={setView} onYearChange={chooseYear} selectedDaXianIndex={periodIndex} /></div><div className="workbench-actions"><button type="button" className="toolbar-button" onClick={() => setHistoryOpen(!historyOpen)} aria-expanded={historyOpen}>历史</button><button type="button" className="toolbar-button" onClick={() => { downloadChartPng(chart,{view,year,daXianIndex:periodIndex}).catch(e => setError(e instanceof Error ? e.message : "导出失败")); }}>图片</button><SettingsButton /><Link className="toolbar-button" href="/library">古籍</Link></div></header>
    {historyOpen && <div className="history-popover no-print"><div className="popover-title"><strong>命盘历史</strong><button type="button" aria-label="关闭历史" onClick={() => setHistoryOpen(false)}>×</button></div>{historyList}</div>}
    {error && <p role="alert" className="form-error">{error}</p>}
    <main className={`chart-workspace ${expanded ? 'is-reading-expanded' : ''}`}>
      <aside className="chart-workspace-left"><div className="chart-context"><span>命盘</span><p>{birth.year}.{birth.month}.{birth.day} · {BRANCHES[birth.hour]}时 · {birth.gender === 'male' ? '男' : '女'}</p></div><ChartBoard key={`${birth.year}-${birth.month}-${birth.day}-${birth.hour}-${birth.gender}`} chart={chart} onPalaceSelect={p => { setSelectedPalace(p); setSelectedStar(null); }} onStarSelect={(s,p) => {setSelectedPalace(p);setSelectedStar(s);}} onViewChange={setView} activeView={view} activeYear={year} activeDaXianIndex={periodIndex} onYearChange={chooseYear} hideTimeNav /><PeriodNavigator chart={chart} view={view} year={year} index={periodIndex} onPeriod={choosePeriod} onYear={chooseYear} />
        {selectedPalace && <div className="palace-selection"><span>{selectedStar ? '星曜焦点' : '宫位焦点'}</span><h3>{selectedStar?.name || selectedPalace.name}</h3><p>{selectedPalace.name} · {BRANCHES[selectedPalace.branch]}宫</p><p>{selectedPalace.stars.filter(s => s.type === 'major').map(s => `${s.name}${s.siHua ? `化${s.siHua}` : ''}`).join('、') || '空宫，借对宫主星'}{selectedStar?.brightnessRaw ? ` · ${selectedStar.brightnessRaw}` : ''}</p></div>}
        <p className="chart-learning-note">点选宫位查看三方四正，点选星曜查看所在宫位。解读区按主题阅读本命内容。</p>
      </aside>
      <section className="chart-workspace-right"><div className="workspace-panel-bar no-print"><div className="workspace-panel-tabs"><button type="button" aria-pressed={pane === 'analysis'} onClick={() => setPane('analysis')}>命盘分析</button><button type="button" aria-pressed={pane === 'chat'} onClick={() => setPane('chat')}>AI 对话</button></div><button type="button" className="reading-expand" onClick={() => setExpanded(!expanded)} aria-label={expanded ? '恢复命盘分栏' : '展开阅读区'}>{expanded ? '↙ 收起' : '↗ 展开'}</button></div>
        <div hidden={pane !== 'analysis'}><DatasetPanel chart={chart} view={view} /></div>
        {pane === 'chat' && <ChatPanel chart={chart} view={view} year={year} selectedDaXianIndex={periodIndex} />}
      </section>
    </main>
  </div>;
}
