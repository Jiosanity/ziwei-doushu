import type { BirthFormState } from '@/components/BirthForm';
import type { BirthInfo } from './types';

import { calculateTrueSolarTime, resolveZiweiDayOffset, shiftGregorianDate } from './true-solar-time';

/** 与表单共用的真太阳时、跨日和晚子时口径。 */
export function formToBirthInfo(form: BirthFormState): BirthInfo {
  const original = { year: Number(form.year), month: Number(form.month), day: Number(form.day) };
  const clockHour = Number(form.clockHour) || 0;
  const clockMinute = Number(form.clockMinute) || 0;
  const longitude = form.province ? form.longitude : undefined;
  const solar = calculateTrueSolarTime({ ...original, clockHour, clockMinute, longitude });
  const date = form.unknownTime ? original : shiftGregorianDate(original, resolveZiweiDayOffset(solar));
  return { ...date, hour: form.unknownTime ? 0 : solar.branch, gender: form.gender,
    timeUnknown: form.unknownTime, name: form.name || undefined, province: form.province || undefined,
    city: form.city || undefined, longitude,
    origInput: form.unknownTime ? undefined : { ...original, clockHour, clockMinute } };
}

/** BirthFormState → URLSearchParams（用于分享链接） */
export function formToSearchParams(form: BirthFormState): URLSearchParams {
  const p = new URLSearchParams();
  if (form.name) p.set('n', form.name);
  p.set('y', form.year);
  p.set('m', form.month);
  p.set('d', form.day);
  if (form.unknownTime) {
    p.set('u', '1');
  } else {
    p.set('h', form.clockHour);
    p.set('mi', form.clockMinute);
  }
  if (form.province) p.set('p', form.province);
  if (form.city) p.set('c', form.city);
  if (form.longitude && form.longitude !== 120) p.set('lo', String(form.longitude));
  p.set('g', form.gender === 'male' ? 'm' : 'f');
  return p;
}

/** URLSearchParams → Partial<BirthFormState>，不完整时返回 null */
export function searchParamsToForm(params: URLSearchParams): Partial<BirthFormState> | null {
  const year = params.get('y');
  const month = params.get('m');
  const day = params.get('d');
  if (!year || !month || !day) return null;
  return {
    name: params.get('n') || '',
    year,
    month,
    day,
    unknownTime: params.get('u') === '1',
    clockHour: params.get('h') || '8',
    clockMinute: params.get('mi') || '0',
    province: params.get('p') || '',
    city: params.get('c') || '',
    longitude: parseFloat(params.get('lo') || '120'),
    gender: params.get('g') === 'f' ? 'female' : 'male',
  };
}
