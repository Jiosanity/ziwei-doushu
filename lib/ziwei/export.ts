import type { ZiweiChart } from './types';
import { BRANCHES, STEMS } from './constants';
import { getDaXianSiHua, getLiuNianSiHua } from './sihua';
import { DATASET_TOPICS } from '../dataset';

export interface ChartExportOptions {
  view?: 'mingpan' | 'daxian' | 'liunian';
  year?: number;
  daXianIndex?: number;
}

const escapeXml = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const positions: Record<number, [number, number]> = { 5: [0,0], 6: [1,0], 7: [2,0], 8: [3,0], 4: [0,1], 9: [3,1], 3: [0,2], 10: [3,2], 2: [0,3], 1: [1,3], 0: [2,3], 11: [3,3] };
const text = (x: number, y: number, value: unknown, size = 18, color = '#252522', anchor = 'start') => `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" text-anchor="${anchor}">${escapeXml(value)}</text>`;

/** Native SVG text keeps vertical star names intact when rasterized or printed. */
export function generateChartSvg(chart: ZiweiChart, options: ChartExportOptions = {}): string {
  const year = options.year ?? new Date().getFullYear();
  const view = options.view ?? 'mingpan';
  const dxIndex = options.daXianIndex ?? chart.currentDaXianIndex;
  const overlay = view === 'daxian' ? getDaXianSiHua(chart, dxIndex, year)?.transforms : view === 'liunian' ? getLiuNianSiHua(year).transforms : undefined;
  const dx = chart.daXians[dxIndex];
  const viewLabel = view === 'liunian' ? `${year} 流年四化` : view === 'daxian' ? `${dx ? `${dx.startAge}—${dx.endAge} 岁` : '童限'} 大限四化` : '本命盘';
  const cellW = 280, cellH = 330, top = 88, left = 24;
  const cells = chart.palaces.map(p => {
    const pos = positions[p.branch];
    if (!pos) return '';
    const x = left + pos[0] * cellW, y = top + pos[1] * cellH;
    // Wrap additional stars into rows; no palace information is clipped.
    const rows = Math.max(1, Math.ceil(p.stars.length / 10));
    const rowH = Math.min(122, 230 / rows);
    const stars = p.stars.map((s, index) => {
      const sx = x + 22 + (index % 10) * 26, sy = y + 34 + Math.floor(index / 10) * rowH;
      const glyphSize = rows > 2 ? 13 : 18;
      const color = s.type === 'major' ? '#a63c37' : s.type === 'sha' ? '#706a84' : '#33332f';
      const chars = Array.from(s.name);
      const glyphs = chars.map((c, i) => `<tspan x="${sx}" y="${sy + i * (glyphSize + 3)}">${escapeXml(c)}</tspan>`).join('');
      const marks = [s.brightnessRaw, s.siHua ? `本${s.siHua}` : '', ...(overlay ? Object.entries(overlay).filter(([, name]) => name === s.name).map(([mark]) => `${view === 'daxian' ? '大' : '年'}${mark}`) : [])].filter(Boolean);
      return `<text font-size="${glyphSize}" fill="${color}" text-anchor="middle">${glyphs}</text>` + marks.map((m, i) => text(sx, sy + chars.length * (glyphSize + 3) + 10 + i * 16, m, 11, i ? '#a63c37' : '#77766e', 'middle')).join('');
    }).join('');
    return `<g data-palace="${escapeXml(p.branch)}"><rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" fill="#fffefb" stroke="#bcb8ad"/>${stars}${text(x + 16, y + 282, `${p.name}${p.isShenGong ? ' · 身宫' : ''}`, 22)}${text(x + 16, y + 310, p.daXianAge ? `${p.daXianAge[0]}—${p.daXianAge[1]} 岁` : '', 14, '#77766e')}${text(x + cellW - 16, y + 310, `${STEMS[p.stem]}${BRANCHES[p.branch]}`, 17, '#55554e', 'end')}</g>`;
  }).join('');
  const b = chart.birthInfo, lunar = chart.lunarInfo;
  const centerLines = [b.name || '紫微命盘', `${b.gender === 'male' ? '男' : '女'} · ${chart.yinYangGender || ''} · ${chart.wuxingJuName}`, `排盘日 ${b.year} 年 ${b.month} 月 ${b.day} 日 · ${BRANCHES[b.hour]}时`, `农历 ${lunar.lunarYear} 年 ${lunar.isLeapMonth ? '闰' : ''}${Math.abs(lunar.lunarMonth)} 月 ${lunar.lunarDay} 日`, [b.province, b.city].filter(Boolean).join(' '), `四柱 ${(lunar.fourPillars || []).join('　')}`, `命主 ${chart.mingZhu || '—'}　身主 ${chart.shenZhu || '—'}`, viewLabel, '本命宫名保留 · 运限叠加四化', '本禄/权/科/忌：本命四化', '大 / 年：所选大限 / 流年四化'];
  const center = centerLines.map((line, i) => text(584, top + cellH + 90 + i * 37, line, i === 0 ? 30 : i > 7 ? 15 : 18, i > 7 ? '#858176' : '#393932', 'middle')).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1168" height="1468" viewBox="0 0 1168 1468" role="img" aria-label="紫微斗数命盘"><rect width="1168" height="1468" fill="#f8f6ef"/><g font-family="'Noto Serif CJK SC','Songti SC','SimSun',serif">${text(24, 45, '紫 微 斗 数', 28)}${text(1144, 45, viewLabel, 17, '#77766e', 'end')}${cells}${center}${text(584, 1440, '传统文化学习与研究 · 命盘资料仅在本地导出', 14, '#858176', 'middle')}</g></svg>`;
}

export async function downloadChartPng(chart: ZiweiChart, options: ChartExportOptions = {}): Promise<void> {
  const url = URL.createObjectURL(new Blob([generateChartSvg(chart, options)], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('命盘图片生成失败，请重试。')); image.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = 2336; canvas.height = 2936;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('当前浏览器不支持图片导出。');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('无法保存命盘图片。')), 'image/png'));
    const pngUrl = URL.createObjectURL(blob);
    try {
      const link = document.createElement('a'); link.href = pngUrl; link.download = `紫微命盘-${chart.birthInfo.year}-${chart.birthInfo.month}-${chart.birthInfo.day}.png`;
      document.body.appendChild(link); link.click(); link.remove();
    } finally { setTimeout(() => URL.revokeObjectURL(pngUrl), 10000); }
  } finally { URL.revokeObjectURL(url); }
}

/** Call directly from a click handler so the browser can open the print tab. */
export function openPrintableReport(chart: ZiweiChart, content: Record<string, string>): void {
  const report = window.open('', '_blank');
  if (!report) throw new Error('浏览器阻止了报告窗口，请允许本站打开新窗口后重试。');
  report.opener = null;
  const sections = DATASET_TOPICS.map(([key, label]) => `<section><h2>${escapeXml(label)}</h2><div class="original">${escapeXml(content[key] || '该主题暂无解读数据。')}</div></section>`).join('');
  report.document.open();
  report.document.write(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>${escapeXml(chart.birthInfo.name || '紫微命盘')} · 十三维解读</title><style>@page{size:A4;margin:18mm}*{box-sizing:border-box}body{max-width:900px;margin:32px auto;padding:0 24px;color:#292923;font:16px/1.9 'Songti SC','SimSun',serif}h1{font-size:30px}h2{font-size:23px;border-bottom:1px solid #ccc;padding-bottom:10px;break-after:avoid}.note{color:#6d6b63;font-size:14px}.board{max-width:720px;margin:24px auto;break-inside:avoid}.board svg{width:100%;height:auto}.original{white-space:pre-wrap;overflow-wrap:anywhere}section{margin-top:36px}button{padding:10px 22px;cursor:pointer;background:#262620;color:white;border:0;border-radius:6px}footer{font-size:13px;border-top:1px solid #ccc;margin-top:40px;padding-top:16px}@media print{body{max-width:none;margin:0;padding:0;font-size:11pt}.toolbar{display:none}.board{max-width:160mm;break-after:page}a{color:inherit}section{margin-top:20px}h2{font-size:17pt}}</style></head><body><div class="toolbar"><button id="print-report" type="button">打印 / 保存为 PDF</button></div><h1>${escapeXml(chart.birthInfo.name || '紫微命盘')} · 十三维解读</h1><p class="note">固定版本本命解读 · 数据生成于 2026-10-15。文中“当前大限”等保留生成时口径，不随今天或所选流年更新。仅供传统文化学习与研究。</p><div class="board">${generateChartSvg(chart)}</div>${sections}<footer>来源：紫微斗数开源解读数据集 v4.0，作者：王多鱼AI。<br><a href="https://github.com/Renhuai123/ziwei-doushu/releases/tag/v4.0-13d" rel="noreferrer">官方数据集发布说明</a></footer></body></html>`);
  report.document.close();
  report.document.getElementById('print-report')?.addEventListener('click', () => report.print());
}
