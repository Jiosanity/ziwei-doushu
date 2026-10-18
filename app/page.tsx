'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { SettingsButton } from '@/components/SiteHeader';
import './home-reconstruction.css';

const modules = [
  { id: 'chart', name: '紫微命盘', en: 'Destiny Engine', category: '易经 · 倪师体系', type: '命盘与十三维解读', desc: '输入生辰，查看您的紫微命盘与传统知识解读', href: '/chart', figure: 'chart' },
  { id: 'heming', name: '合盘分析', en: 'Synastry', category: '关系 · 双盘对照', type: '双人命盘', desc: '从两人的宫位与星曜，了解关系中的不同视角', href: '/heming', figure: 'pair' },
  { id: 'twins', name: '命理学双子', en: 'Chart Twins', category: '同盘 · 结构研究', type: '命盘研究', desc: '相似命盘的研究，从看懂自己的星曜与宫位开始', href: '', figure: 'twins' },
  { id: 'sanji', name: '三纪', en: 'Three Disciplines', category: '天地人 · 三纪同源', type: '传统文化研读', desc: '天纪观星、地纪察宅、人纪明理，以经典为起点', href: '', figure: 'sanji' },
  { id: 'academy', name: '学术中心', en: 'Academy', category: '星曜 · 古籍原典', type: '阅读与学习', desc: '查星曜论断文章，读紫微斗数古籍原文', href: '/library', figure: 'books' },
];

const referenceArtwork: Record<string, string> = {
  chart: 'metis-showcase-chart-20260709.jpg', pair: 'metis-showcase-heming-20260925.jpg',
  twins: 'destiny-twins-20261007.jpg', sanji: 'sanji-mythic-20260717.jpg', books: 'academy-shuge-20261006.jpg',
};

function Figure({ kind }: { kind: string }) {
  return <div className={`editorial-figure editorial-figure--${kind}`} aria-hidden="true">
    <img className="editorial-reference-art" src={`https://static.metisziwei.com/images/scenes/${referenceArtwork[kind]}`} alt="" loading={kind === 'chart' ? 'eager' : 'lazy'} referrerPolicy="no-referrer" onError={e => { e.currentTarget.style.display = 'none'; }} />
    <div className="editorial-orbit orbit-one" /><div className="editorial-orbit orbit-two" />
    <div className="editorial-cross" /><span className="editorial-figure-character">{kind === 'books' ? '典' : kind === 'sanji' ? '三' : '紫'}</span>
    <div className="editorial-figure-grid">{Array.from({ length: 16 }, (_, i) => <i key={i} />)}</div>
    <span className="editorial-figure-caption">ZI WEI DOU SHU / CULTURAL STUDIES</span>
  </div>;
}

export default function HomePage() {
  const [active, setActive] = useState(0);
  const [menu, setMenu] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const cards = useRef<(HTMLElement | null)[]>([]);
  const { theme, toggle } = useTheme();

  useEffect(() => {
    const update = () => {
      let nearest = 0; let distance = Infinity;
      cards.current.forEach((card, i) => {
        if (!card) return;
        const bounds = card.getBoundingClientRect();
        const current = Math.abs(bounds.top + bounds.height / 2 - window.innerHeight / 2);
        if (current < distance) { distance = current; nearest = i; }
      });
      setActive(nearest);
    };
    update(); window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, []);

  const go = (i: number) => { cards.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setMenu(false); };
  const current = modules[active];

  return <main className="editorial-home">
    <h1 className="sr-only">紫微斗数 · 命盘排盘与传统文化研习</h1>
    <header className="editorial-header">
      <Link href="/" className="editorial-brand" aria-label="紫微斗数首页">ZIWEI<span>紫微斗数 · 三纪</span></Link>
      <div className="editorial-header-actions"><SettingsButton /><button onClick={toggle} aria-label={theme === 'dark' ? '切换亮色' : '切换暗色'}>{theme === 'dark' ? '亮色' : '暗色'}</button><Link href="/chart">起盘 ↗</Link><button className="editorial-menu-trigger" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label="打开导航">{menu ? '关闭' : '菜单'}</button></div>
    </header>
    <nav className={`editorial-navigation${menu ? ' is-open' : ''}`} aria-label="主要内容">{modules.map((item, i) => <button key={item.id} onClick={() => go(i)} aria-current={i === active ? 'true' : undefined}><span>{String(i + 1).padStart(2, '0')}</span>{item.name}</button>)}</nav>
    <div className="editorial-category" aria-live="polite">{current.category}</div>
    <div className="editorial-type"><span>{current.type}</span><b>{String(active + 1).padStart(2, '0')}</b></div>
    <div className="editorial-modules">
      {modules.map((item, i) => <section key={item.id} id={item.id} ref={element => { cards.current[i] = element; }} className={`editorial-module${i === active ? ' is-active' : ''}`} aria-label={item.name}>
        {item.href ? <Link className="editorial-card" href={item.href}><Figure kind={item.figure} /><div className="editorial-card-content"><h2>{item.name}</h2><p className="editorial-en">{item.en}</p><p>{item.desc}</p><span className="editorial-enter">进入 ↗</span></div></Link> : <>
          <button className="editorial-card" onClick={() => setExpanded(expanded === item.id ? null : item.id)} aria-expanded={expanded === item.id}><Figure kind={item.figure} /><div className="editorial-card-content"><h2>{item.name}</h2><p className="editorial-en">{item.en}</p><p>{item.desc}</p><span className="editorial-enter">了解更多 ＋</span></div></button>
          {expanded === item.id && <div className="editorial-module-detail">{item.id === 'twins' ? <><p>同盘匹配功能尚未接入。现在可以起盘，阅读对应的十三维本命解读。</p><Link href="/chart">查看自己的命盘 ↗</Link></> : <><p>三纪课程尚未收录。古籍原典库提供可阅读、可搜索的传统典籍。</p><Link href="/library">进入古籍库 ↗</Link></>}</div>}
        </>}
      </section>)}
    </div>
    <footer className="editorial-footer"><div><Link href="/chart">起盘</Link><span>·</span><Link href="/knowledge">知识库</Link><span>·</span><Link href="/library">古籍库</Link><span>·</span><Link href="/privacy">隐私</Link><span>·</span><Link href="/terms">服务条款</Link></div><p>© {new Date().getFullYear()} 紫微斗数 · 自部署研习站</p><p>传统文化学习与研究 · <a href="https://metisziwei.com" target="_blank" rel="noreferrer">参考插画：Metis紫微</a></p></footer>
  </main>;
}
