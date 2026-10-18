import { aiConfig } from '@/lib/ai/provider';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET() {
  const config = aiConfig();
  return Response.json({ configured: Boolean(config.key), model: config.model }, { headers: { 'Cache-Control': 'no-store' } });
}
