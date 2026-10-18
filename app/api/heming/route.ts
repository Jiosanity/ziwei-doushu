import { rebuildChart, chartFacts, datasetContext, relationshipContext, SYSTEM_PROMPT, InputError } from '@/lib/ai/context';
import { messagesFrom, streamAnswer } from '@/lib/ai/provider';
import { readBody, inputFailure } from '@/lib/ai/request';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 130;
export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const chartA = rebuildChart(body.chartA), chartB = rebuildChart(body.chartB);
    if (body.question !== undefined && (typeof body.question !== 'string' || body.question.length > 4000)) throw new InputError('问题不能超过 4000 字。');
    const question = (typeof body.question === 'string' && body.question.trim()) || '请分析两人的性格、沟通与相处方式、关系优势和需要协调的问题。';
    let messages;
    try { messages = messagesFrom(body.messages ?? [{ role: 'user', content: question }]); } catch (error) { throw new InputError((error as Error).message); }
    const [datasetA, datasetB] = await Promise.all([datasetContext(chartA, '感情'), datasetContext(chartB, '感情')]);
    return await streamAnswer(SYSTEM_PROMPT, { task: '双人合盘文化解读',
      A: { chart: chartFacts(chartA), dataset: datasetA, publicRelationshipNotes: relationshipContext(chartA) },
      B: { chart: chartFacts(chartB), dataset: datasetB, publicRelationshipNotes: relationshipContext(chartB) } }, messages, request.signal);
  } catch (error) { return inputFailure(error); }
}
