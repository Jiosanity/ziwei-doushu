'use client';
import type { Palace, Star } from '@/lib/ziwei/types';
import { STEMS, BRANCHES } from '@/lib/ziwei/constants';

interface PalaceCellProps {
  palace: Palace;
  onClick?: () => void;
  onStarClick?: (star: Star) => void;
  isSelected?: boolean;
  isSanFang?: boolean;
  delay?: number;
  overlayStarSiHua?: Record<string, string>;
  overlayLabel?: string;
  onSiHuaClick?: (starName: string, siHua: string) => void;
}

export default function PalaceCell({ palace, onClick, onStarClick, isSelected, isSanFang, overlayStarSiHua, overlayLabel, onSiHuaClick }: PalaceCellProps) {
  const { branch, stem, name, stars, daXianAge, isCurrentDaXian, isMingGong, isShenGong } = palace;
  return <div className={`palace-cell ${isSelected ? 'is-selected' : ''} ${isSanFang ? 'is-surrounding' : ''}`} role="button" tabIndex={0} aria-pressed={!!isSelected} aria-label={`${name}，查看三方四正`} onClick={onClick} onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick?.(); } }}>
    <div className="palace-stars">{stars.map(star => <div className={`palace-star palace-star--${star.type}`} key={star.name}>
      <button type="button" className="palace-star-name" aria-label={`${star.name}${star.brightnessRaw ? `，${star.brightnessRaw}` : ''}`} onClick={e => { e.stopPropagation(); onStarClick?.(star); }}>{star.name}</button>
      {star.brightnessRaw && <span className="palace-star-brightness">{star.brightnessRaw}</span>}
      {star.siHua && <span className={`palace-sihua palace-sihua--${star.siHua}`}>{star.siHua}</span>}
      {overlayStarSiHua?.[star.name] && <button type="button" className="palace-overlay-sihua" onClick={e => { e.stopPropagation(); onSiHuaClick?.(star.name, overlayStarSiHua[star.name]); }}>{overlayLabel}{overlayStarSiHua[star.name]}</button>}
    </div>)}</div>
    <div className="palace-cell-foot"><span className={`palace-age ${isCurrentDaXian ? 'is-current' : ''}`}>{daXianAge ? `${daXianAge[0]}–${daXianAge[1]}` : ''}</span><span className="palace-label"><small>{STEMS[stem]}{BRANCHES[branch]}</small><strong>{name}{isMingGong ? '·命' : ''}{isShenGong ? '·身' : ''}</strong></span></div>
  </div>;
}
