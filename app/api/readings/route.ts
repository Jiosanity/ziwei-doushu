import { NextRequest, NextResponse } from 'next/server';
import { inflateSync } from 'node:zlib';
// @ts-expect-error Node 22 builtin; the project currently uses Node 20 type declarations.
import { DatabaseSync } from 'node:sqlite';
import { generateChart } from '@/lib/ziwei/algorithm';
import { DATASET_TOPICS } from '@/lib/dataset';
import { isValidGregorianDate } from '@/lib/ziwei/true-solar-time';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });

export async function POST(request: NextRequest) {
  let body;
  try { body = await request.json(); } catch { return reply({ error: '请求格式错误' }, 400); }
  if (!body || typeof body !== 'object') return reply({ error: '请求格式错误' }, 400);
  const { year, month, day, hour, gender, mainStar } = body;
  if (!isValidGregorianDate(year, month, day) || !Number.isInteger(hour) || hour < 0 || hour > 11
    || !['male', 'female'].includes(gender) || !(mainStar === null || typeof mainStar === 'string')) {
    return reply({ error: '日期、时辰或性别无效' }, 400);
  }
  if (year < 1950 || year > 2026) return reply({ error: '数据集覆盖 1950—2026 年，此命盘暂无预生成解读。' }, 404);
  const chart = generateChart({ year, month, day, hour, gender });
  const expected = chart.palaces.find(p => p.isMingGong)?.stars.find(s => s.type === 'major')?.name ?? null;
  if (mainStar !== expected) return reply({ error: '页面命盘与默认排盘口径不一致，暂不展示数据集解读。' }, 409);
  const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}-${hour}-${gender}`;
  let db;
  try {
    db = new DatabaseSync(process.env.DATASET_DB_PATH || '/data/readings.sqlite', { readOnly: true });
    const row = db.prepare('SELECT ms, content FROM readings WHERE k = ?').get(key) as { ms: string | null; content: Uint8Array } | undefined;
    if (!row) return reply({ error: '此命盘暂无预生成解读。' }, 404);
    if (row.ms !== expected) return reply({ error: '数据集主星与当前命盘不一致，暂不展示解读。' }, 409);
    const content = JSON.parse(inflateSync(row.content).toString('utf8')) as Record<string, string>;
    if (!DATASET_TOPICS.every(([topic]) => typeof content[topic] === 'string')) throw new Error('Invalid dataset content');
    return reply({ key, version: 'v4.0-13d', generatedAt: '2026-10-15', content });
  } catch (error) {
    console.error('Dataset read failed', error instanceof Error ? error.message : 'unknown');
    return reply({ error: '解读数据暂时不可用，请稍后重试。' }, 503);
  } finally { db?.close(); }
}
