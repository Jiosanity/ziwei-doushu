import assert from 'node:assert/strict';
import { generateChart } from '../../lib/ziwei/algorithm';
import { generateChartSvg } from '../../lib/ziwei/export';

const chart = generateChart({ year: 1990, month: 6, day: 15, hour: 4, gender: 'female', name: '<script>alert("x")</script>', city: '<img src=x onerror=alert(1)>' });
const svg = generateChartSvg(chart);
assert(!svg.includes('<script>'));
assert(!svg.includes('<img'));
assert(svg.includes('&lt;script&gt;'));
assert(svg.includes('&lt;img'));
assert.equal((svg.match(/data-palace=/g) || []).length, 12);
for (const palace of chart.palaces) assert(svg.includes(`data-palace="${palace.branch}"`));
assert(svg.includes('<tspan'));
assert(!svg.includes('foreignObject'));
assert(!svg.includes('href='));
assert(generateChartSvg(chart, { view: 'liunian', year: 2027 }).includes('2027 流年四化'));
assert(generateChartSvg(chart, { view: 'daxian', daXianIndex: 0 }).includes('大限四化'));
console.log('Export safety and palace coverage passed.');
