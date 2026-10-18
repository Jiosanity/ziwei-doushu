'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from './ThemeProvider';

export function SettingsButton() {
  const [open, setOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const dialog = useRef<HTMLDialogElement>(null);
  const [paper, setPaper] = useState('white');
  const [size, setSize] = useState('normal');
  const [aiError,setAiError] = useState(false);
  const [ai, setAi] = useState<{ configured: boolean; model: string } | null>(null);
  useEffect(() => {
    setPaper(document.documentElement.dataset.paper || 'white');
    setSize(document.documentElement.dataset.readingSize || 'normal');
  }, []);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch('/api/ai/status', {signal:controller.signal, cache:'no-store'}).then(async r => {
      if (!r.ok) throw new Error('status unavailable');
      return r.json();
    }).then(value => { if (!controller.signal.aborted) setAi(value); }).catch(() => { if (!controller.signal.aborted) setAiError(true); });
    return () => controller.abort();
  }, [open]);
  const preference = (key: 'paper' | 'readingSize', value: string) => {
    document.documentElement.dataset[key] = value;
    try { localStorage.setItem(`ziwei-${key}`, value); } catch { /* browser storage disabled */ }
    if (key === 'paper') setPaper(value); else setSize(value);
  };
  return <>
    <button className="site-settings-button" type="button" onClick={() => setOpen(true)} aria-haspopup="dialog">设置 <span aria-hidden="true">⚙</span></button>
    <dialog ref={dialog} className="settings-dialog" onCancel={() => setOpen(false)} onClick={e => { if (e.target === dialog.current) setOpen(false); }}>
      <div className="settings-head"><h2>设置</h2><button type="button" aria-label="关闭设置" onClick={() => setOpen(false)}>×</button></div>
      <div className="settings-row"><div><strong>外观</strong><p>切换明亮或深色界面</p></div><button type="button" className="settings-value" onClick={toggle}>{theme === 'dark' ? '深色' : '浅色'} ⇄</button></div>
      <div className="settings-row"><div><strong>纸张</strong><p>浅色模式的页面底色</p></div><div className="settings-choices">{[['white','纯白'],['ivory','米白']].map(([value,label]) => <button key={value} type="button" aria-pressed={paper === value} onClick={() => preference('paper',value)}>{label}</button>)}</div></div>
      <div className="settings-row"><div><strong>阅读字号</strong><p>命盘解读的正文字号</p></div><div className="settings-choices">{[['normal','标准'],['large','大字']].map(([value,label]) => <button key={value} type="button" aria-pressed={size === value} onClick={() => preference('readingSize',value)}>{label}</button>)}</div></div>
      <div className="settings-row"><div><strong>AI 解读</strong><p>{ai ? ai.configured ? `已配置 ${ai.model}，可在命盘中发起 AI 对话。` : 'DeepSeek Flash 接口已准备，等待服务器配置密钥。' : aiError ? '暂时无法读取模型服务状态。' : '正在读取模型服务状态…'}</p></div></div>
      <div className="settings-source"><strong>数据与来源</strong><p>紫微斗数开源解读数据集 v4.0 · 1950—2026 年</p><a href="https://github.com/Renhuai123/ziwei-doushu" target="_blank" rel="noreferrer">作者：王多鱼AI · 开源项目</a></div>
    </dialog>
  </>;
}

export default function SiteHeader({ compact = false }: { compact?: boolean }) {
  const [menu, setMenu] = useState(false);
  return <header className={`site-header ${compact ? 'site-header--compact' : ''}`}>
    <Link className="site-wordmark" href="/" aria-label="返回首页">ZIWEI{!compact && <span>紫微斗数 · 三纪</span>}</Link>
    <nav className="site-desktop-nav" aria-label="主导航"><Link href="/chart">起盘</Link><Link href="/heming">合盘</Link><Link href="/knowledge">知识库</Link><Link href="/library">古籍库</Link></nav>
    <div className="site-header-actions"><span className="site-edition">自部署版</span><SettingsButton /><button className="site-menu-toggle" type="button" aria-expanded={menu} aria-label={menu ? '关闭菜单' : '打开菜单'} onClick={() => setMenu(!menu)}>{menu ? '×' : '☰'}</button></div>
    {menu && <nav className="site-mobile-menu" aria-label="移动导航">{[['/chart','起紫微命盘'],['/heming','双人合盘'],['/knowledge','知识库'],['/library','古籍原典']].map(([href,label],i) => <Link href={href} key={href} onClick={() => setMenu(false)}><small>0{i+1}</small>{label}</Link>)}</nav>}
  </header>;
}
