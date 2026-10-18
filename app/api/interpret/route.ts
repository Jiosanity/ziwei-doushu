import { rebuildChart, chartFacts, periodFacts, datasetContext, classicsContext, SYSTEM_PROMPT, InputError } from '@/lib/ai/context';
import { messagesFrom, streamAnswer } from '@/lib/ai/provider';
import { readBody, inputFailure } from '@/lib/ai/request';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 130;
export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const chart = rebuildChart(body.chart);
    let messages;
    try { messages = messagesFrom(body.messages); } catch (error) { throw new InputError((error as Error).message); }
    const period = periodFacts(chart, body);
    const question = messages[messages.length - 1].content;
    return await streamAnswer(SYSTEM_PROMPT, { chart: chartFacts(chart), period,
      dataset: await datasetContext(chart, question), classics: classicsContext(chart) }, messages, request.signal);
  } catch (error) { return inputFailure(error); }
}
