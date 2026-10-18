'use client';
import type { ZiweiChart } from '@/lib/ziwei/types';
import { BRANCHES, STEMS } from '@/lib/ziwei/constants';
import { CHILDHOOD_DAXIAN_INDEX, getChildhoodYears, getDaXianYears } from '@/lib/ziwei/yunxian-context';
import type { TimeView } from './TimeNav';

export default function PeriodNavigator({ chart, view, year, index, onPeriod, onYear }: {
  chart: ZiweiChart; view: TimeView; year: number; index: number;
  onPeriod: (index: number) => void; onYear: (year: number) => void;
}) {
  const childhood = getChildhoodYears(chart);
  const years = index === CHILDHOOD_DAXIAN_INDEX ? childhood : getDaXianYears(chart, index);
  const shownYears = years.length ? years : Array.from({length:10},(_,i)=>year-4+i);
  return <div className="period-navigator">
    <div className="period-row-head"><h3>大限</h3><span>按虚岁选择，流年随所属十年联动</span></div>
    <div className="period-strip" aria-label="选择大限">{childhood.length > 0 && <button type="button" aria-pressed={index === CHILDHOOD_DAXIAN_INDEX} onClick={() => onPeriod(CHILDHOOD_DAXIAN_INDEX)}><span>1–{childhood.length}岁</span><strong>童限</strong><small>起限前</small></button>}{chart.daXians.map((dx,i) => <button type="button" key={i} aria-pressed={index === i} onClick={() => onPeriod(i)}><span>{dx.startAge}–{dx.endAge}岁</span><strong>{dx.stemName || STEMS[dx.stemIndex ?? chart.palaces[dx.palaceBranch]?.stem ?? 0]}{BRANCHES[dx.palaceBranch]}</strong><small>{dx.palaceName}</small></button>)}</div>
    <div className="period-row-head period-row-head--year"><h3>流年</h3><span>点击年份，按农历生年计算虚岁</span></div>
    <div className="period-strip period-strip--year" aria-label="选择流年">{shownYears.map(y => <button type="button" key={y} aria-pressed={view === 'liunian' && year === y} onClick={() => onYear(y)}><strong>{y}</strong><span>{y - chart.lunarInfo.lunarYear + 1}岁</span><small>{STEMS[((y-4)%10+10)%10]}{BRANCHES[((y-4)%12+12)%12]}</small></button>)}</div>
  </div>;
}
