'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ZiweiChart, Palace, Star } from '@/lib/ziwei/types';
import { BRANCHES, STEMS } from '@/lib/ziwei/constants';
import PalaceCell from './PalaceCell';
import { getChildhoodDaXianPalace, CHILDHOOD_DAXIAN_INDEX } from '@/lib/ziwei/yunxian-context';
import TimeNav, { type TimeView, getYearStemIndex, buildSiHuaOverlay } from './TimeNav';

interface ChartBoardProps {
  chart: ZiweiChart;
  onStarSelect?: (star: Star, palace: Palace) => void;
  onPalaceSelect?: (palace: Palace) => void;
  onSiHuaClick?: (starName: string, siHua: string, view: TimeView) => void;
  onViewChange?: (view: TimeView) => void;
  activeView?: TimeView;
  activeYear?: number;
  onYearChange?: (year: number) => void;
  hideTimeNav?: boolean;
  activeDaXianIndex?: number;
}

const BRANCH_GRID_POS: Record<number, [number, number]> = {
  5: [1, 1], 6: [1, 2], 7: [1, 3], 8: [1, 4],
  4: [2, 1], 9: [2, 4],
  3: [3, 1], 10: [3, 4],
  2: [4, 1], 1: [4, 2], 0: [4, 3], 11: [4, 4],
};

// 每个地支宫位在网格中的中心坐标（百分比）
const BRANCH_SVG_POS: Record<number, [number, number]> = {
  5: [12.5, 12.5], 6: [37.5, 12.5], 7: [62.5, 12.5], 8: [87.5, 12.5],
  4: [12.5, 37.5],                                      9: [87.5, 37.5],
  3: [12.5, 62.5],                                     10: [87.5, 62.5],
  2: [12.5, 87.5], 1: [37.5, 87.5], 0: [62.5, 87.5], 11: [87.5, 87.5],
};

// 绕盘面顺时针排列（用于三方四正四边形排序）
const CLOCKWISE_INDEX: Record<number, number> = {
  5: 0, 6: 1, 7: 2, 8: 3,
  9: 4, 10: 5,
  11: 6, 0: 7, 1: 8, 2: 9,
  3: 10, 4: 11,
};

function sortClockwise(branches: number[]): number[] {
  return [...branches].sort((a, b) => CLOCKWISE_INDEX[a] - CLOCKWISE_INDEX[b]);
}

/** 三方四正：本宫 + 对宫 + 两个三合宫 */
function getSanFangSiZheng(branch: number): [number, number, number, number] {
  return [
    branch,
    (branch + 6) % 12,   // 对宫
    (branch + 4) % 12,   // 三合1
    (branch + 8) % 12,   // 三合2
  ];
}

const ANIMATION_ORDER = [5, 6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4];

export default function ChartBoard({ chart, onStarSelect, onPalaceSelect, onSiHuaClick, onViewChange, activeView, activeYear, onYearChange, hideTimeNav, activeDaXianIndex }: ChartBoardProps) {
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [localView, setTimeView] = useState<TimeView>('mingpan');
  const timeView = activeView ?? localView;
  const [localYear, setLiunianYear] = useState<number>(new Date().getFullYear());
  const liunianYear = activeYear ?? localYear;

  const palaceMap: Record<number, Palace> = {};
  chart.palaces.forEach(p => { palaceMap[p.branch] = p; });

  // 计算当前叠加四化数据（大限或流年）
  const effectiveIndex = activeDaXianIndex ?? chart.currentDaXianIndex;
  const currentDx = chart.daXians[effectiveIndex];
  const periodPalace = effectiveIndex === CHILDHOOD_DAXIAN_INDEX ? getChildhoodDaXianPalace(chart, liunianYear) : currentDx ? palaceMap[currentDx.palaceBranch] : null;
  const overlayData: Record<string, string> = (() => {
    if (timeView === 'daxian' && periodPalace) {
      const dxPalace = periodPalace;
      if (dxPalace) return buildSiHuaOverlay(dxPalace.stem);
    }
    if (timeView === 'liunian') {
      return buildSiHuaOverlay(getYearStemIndex(liunianYear));
    }
    return {};
  })();
  const overlayLabel = timeView === 'daxian' ? '限' : timeView === 'liunian' ? '年' : undefined;

  const handlePalaceClick = (branch: number) => {
    const isDeselecting = selectedBranch === branch;
    setSelectedBranch(prev => prev === branch ? null : branch);
    if (!isDeselecting) {
      const palace = palaceMap[branch];
      if (palace) onPalaceSelect?.(palace);
    }
  };

  // 三方四正
  const sanFangBranches = selectedBranch !== null ? getSanFangSiZheng(selectedBranch) : null;
  const sanFangSet = sanFangBranches ? new Set(sanFangBranches) : null;

  return (
    <div className="w-full select-none">
      {/* 时间导航轴 */}
      {!hideTimeNav && <TimeNav
        chart={chart}
        selectedDaXianIndex={effectiveIndex}
        view={timeView}
        liunianYear={liunianYear}
        onViewChange={view => { setTimeView(view); onViewChange?.(view); }}
        onYearChange={year => { setLiunianYear(year); onYearChange?.(year); }}
      />}

      {/* 4x4 命盘网格（含 SVG 叠加层） */}
      <div
        className="grid rounded-xl overflow-hidden relative"
        style={{
          gridTemplateColumns: 'repeat(4, 1fr)',
          gridTemplateRows: 'repeat(4, minmax(156px, auto))',
          gap: '1px',
          background: 'var(--bdr-med)',
          border: '1px solid var(--bdr-med)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.05)',
        }}
      >
        {ANIMATION_ORDER.map((branch, i) => {
          const [row, col] = BRANCH_GRID_POS[branch];
          const palace = palaceMap[branch];
          if (!palace) return null;
          return (
            <div key={branch} style={{ gridRow: row, gridColumn: col, background: 'var(--bg-0)' }}>
              <PalaceCell
                palace={{ ...palace, isCurrentDaXian: periodPalace?.branch === palace.branch }}
                onClick={() => handlePalaceClick(branch)}
                onStarClick={(star) => onStarSelect?.(star, palace)}
                isSelected={selectedBranch === branch}
                isSanFang={!!(sanFangSet?.has(branch) && selectedBranch !== branch)}
                delay={i * 0.04}
                overlayStarSiHua={Object.keys(overlayData).length > 0 ? overlayData : undefined}
                overlayLabel={overlayLabel}
                onSiHuaClick={(starName, siHua) => onSiHuaClick?.(starName, siHua, timeView)}
              />
            </div>
          );
        })}

        <div className="palace-center-tile" style={{ gridRow: '2 / 4', gridColumn: '2 / 4', background: 'var(--bg-0)' }}>
          <div className="palace-center-brand">ZIWEI</div>
          <p className="palace-center-type">{chart.yinYangGender || (chart.birthInfo.gender === 'male' ? '男命' : '女命')}　{chart.wuxingJuName}</p>
          <div className="palace-pillars"><div><span>节气四柱</span><strong>{chart.lunarInfo.fourPillars?.join(' ') || '—'}</strong></div><div><span>非节气四柱</span><strong>{chart.lunarInfo.fourPillarsLunar?.join(' ') || '—'}</strong></div></div>
          <div className="palace-center-meta"><span>命主 <b>{chart.mingZhu || '—'}</b></span><span>身主 <b>{chart.shenZhu || '—'}</b></span><span>命宫 <b>{BRANCHES[chart.mingGongBranch]}</b></span><span>身宫 <b>{BRANCHES[chart.shenGongBranch]}</b></span></div>
          <p className="palace-center-date">排盘日　{chart.birthInfo.year}.{chart.birthInfo.month}.{chart.birthInfo.day}　{BRANCHES[chart.birthInfo.hour]}时</p>
          <p className="palace-center-date">农历　{chart.lunarInfo.lunarYear}年{chart.lunarInfo.isLeapMonth ? '闰' : ''}{Math.abs(chart.lunarInfo.lunarMonth)}月{chart.lunarInfo.lunarDay}日</p>
          {chart.birthInfo.origInput && <p className="palace-center-date">钟表时　{chart.birthInfo.origInput.year}.{chart.birthInfo.origInput.month}.{chart.birthInfo.origInput.day} {String(chart.birthInfo.origInput.clockHour).padStart(2, '0')}:{String(chart.birthInfo.origInput.clockMinute).padStart(2, '0')}</p>}
          {currentDx && <p className="palace-center-period">{timeView === 'mingpan' ? '当前大限' : '所选大限'} <strong>{currentDx?.startAge}–{currentDx?.endAge}岁</strong> {currentDx?.palaceName}</p>}
          {chart.birthInfo.city && <p className="palace-center-city">{chart.birthInfo.city} · 真太阳时校正</p>}
        </div>

        {/* ── 三方四正 SVG 连线（绝对定位在 grid 内部，受 overflow:hidden 裁切） ── */}
        <AnimatePresence>
          {sanFangBranches !== null && (
            <motion.div
              key={`sf-${selectedBranch}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="pointer-events-none"
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 20,
              }}
            >
              <svg
                width="100%"
                height="100%"
                xmlns="http://www.w3.org/2000/svg"
                style={{ display: 'block' }}
              >
                {(() => {
                  // 三角形（三方）+ 一条直线（对宫）
                  const p0 = BRANCH_SVG_POS[sanFangBranches[0]]; // 本宫
                  const p1 = BRANCH_SVG_POS[sanFangBranches[1]]; // 对宫
                  const p2 = BRANCH_SVG_POS[sanFangBranches[2]]; // 三合1
                  const p3 = BRANCH_SVG_POS[sanFangBranches[3]]; // 三合2
                  const dash = "6,5";
                  const stroke = "rgba(37,99,235,0.55)";
                  const sw = "1.5";
                  return (
                    <>
                      {/* 对宫直线：本宫 ↔ 对宫（穿过中心） */}
                      <line
                        x1={`${p0[0]}%`} y1={`${p0[1]}%`}
                        x2={`${p1[0]}%`} y2={`${p1[1]}%`}
                        stroke={stroke} strokeWidth={sw}
                        strokeDasharray={dash} strokeLinecap="round"
                      />
                      {/* 三合三角形：本宫 → 三合1 → 三合2 → 本宫 */}
                      <line
                        x1={`${p0[0]}%`} y1={`${p0[1]}%`}
                        x2={`${p2[0]}%`} y2={`${p2[1]}%`}
                        stroke={stroke} strokeWidth={sw}
                        strokeDasharray={dash} strokeLinecap="round"
                      />
                      <line
                        x1={`${p2[0]}%`} y1={`${p2[1]}%`}
                        x2={`${p3[0]}%`} y2={`${p3[1]}%`}
                        stroke={stroke} strokeWidth={sw}
                        strokeDasharray={dash} strokeLinecap="round"
                      />
                      <line
                        x1={`${p3[0]}%`} y1={`${p3[1]}%`}
                        x2={`${p0[0]}%`} y2={`${p0[1]}%`}
                        stroke={stroke} strokeWidth={sw}
                        strokeDasharray={dash} strokeLinecap="round"
                      />
                      {/* 四个宫位中心标记点 */}
                      {[p0, p1, p2, p3].map((p, i) => (
                        <circle
                          key={i}
                          cx={`${p[0]}%`} cy={`${p[1]}%`}
                          r="3"
                          fill={i === 0 ? 'rgba(37,99,235,0.8)' : 'rgba(37,99,235,0.45)'}
                        />
                      ))}
                    </>
                  );
                })()}
              </svg>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 图例 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="mt-3 flex items-center justify-center gap-2 text-[9px] flex-wrap"
      >
        {[
          { h: '化禄', c: 'text-emerald-500 border-emerald-500/30' },
          { h: '化权', c: 'text-blue-500 border-blue-500/30' },
          { h: '化科', c: 'text-yellow-500 border-yellow-500/30' },
          { h: '化忌', c: 'text-red-500 border-red-500/30' },
        ].map(({ h, c }) => (
          <span key={h} className={`border px-1.5 py-0.5 rounded-full font-medium ${c}`}>{h}</span>
        ))}
        <span className="px-1.5 py-0.5 rounded-full" style={{ color: 'var(--tx-3)', border: '1px solid var(--bdr-med)' }}>
          点击宫位看三方四正
        </span>
      </motion.div>
    </div>
  );
}
