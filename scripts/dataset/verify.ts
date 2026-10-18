import assert from 'node:assert/strict';
// @ts-expect-error Node 22 builtin; the project currently uses Node 20 type declarations.
import { DatabaseSync } from 'node:sqlite';
import { generateChart } from '../../lib/ziwei/algorithm';
import { calculateTrueSolarTime, resolveZiweiDayOffset, shiftGregorianDate } from '../../lib/ziwei/true-solar-time';

const db = new DatabaseSync(process.env.DATASET_DB_PATH || '/data/readings.building.sqlite', { readOnly: true });
const rows = db.prepare("SELECT k, ms FROM readings WHERE k LIKE '1990-%' ORDER BY k").all() as { k: string; ms: string | null }[];
assert.equal(rows.length, 8760);
let checked = 0;
for (let i = 0; i < rows.length; i += 23) {
  const row = rows[i];
  const [y, m, d, h, g] = row.k.split('-');
  const chart = generateChart({ year: +y, month: +m, day: +d, hour: +h, gender: g as 'male' | 'female' });
  const star = chart.palaces.find(p => p.isMingGong)?.stars.find(s => s.type === 'major')?.name ?? null;
  assert.equal(star, row.ms, row.k);
  checked++;
}
const midnight = calculateTrueSolarTime({ year: 1990, month: 1, day: 1, clockHour: 23, clockMinute: 30 });
assert.equal(midnight.branch, 0);
assert.deepEqual(shiftGregorianDate({ year: 1990, month: 1, day: 1 }, resolveZiweiDayOffset(midnight)), { year: 1990, month: 1, day: 2 });
const west = calculateTrueSolarTime({ year: 1990, month: 1, day: 1, clockHour: 0, clockMinute: 30, longitude: 75 });
assert.equal(west.branch, 11);
assert.deepEqual(shiftGregorianDate({ year: 1990, month: 1, day: 1 }, resolveZiweiDayOffset(west)), { year: 1989, month: 12, day: 31 });
db.close();
console.log(`Verified ${checked} date/hour/gender samples against dataset, plus late-Zi and longitude date rollover.`);
