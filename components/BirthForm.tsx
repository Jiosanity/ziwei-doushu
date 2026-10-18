'use client';
import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { BirthInfo } from '@/lib/ziwei/types';
import { SHICHEN } from '@/lib/ziwei/constants';
import './birth-form.css';
import { PROVINCES } from '@/lib/ziwei/cities';
import { calculateTrueSolarTime, resolveZiweiDayOffset, shiftGregorianDate } from '@/lib/ziwei/true-solar-time';

export interface BirthFormState {
  name: string;
  year: string;
  month: string;
  day: string;
  clockHour: string;
  clockMinute: string;
  unknownTime: boolean;
  province: string;
  city: string;
  longitude: number;
  gender: 'male' | 'female';
}

interface BirthFormProps {
  onSubmit: (info: BirthInfo) => void;
  loading?: boolean;
  initialData?: Partial<BirthFormState>;
  onFormSave?: (data: BirthFormState) => void;
  /** 隐藏内部「立即起盘」按钮（合盘等场景由父级统一触发） */
  hideSubmit?: boolean;
}

const SHICHEN_NAMES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

/** 检查日期是否合法 */
function isValidDate(y: number, m: number, d: number): boolean {
  if (!y || !m || !d) return false;
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export default function BirthForm({ onSubmit, loading, initialData, onFormSave, hideSubmit }: BirthFormProps) {
  const [form, setForm] = useState<BirthFormState>({
    name: initialData?.name ?? '',
    year: initialData?.year ?? '',
    month: initialData?.month ?? '',
    day: initialData?.day ?? '',
    clockHour: initialData?.clockHour ?? '8',
    clockMinute: initialData?.clockMinute ?? '0',
    unknownTime: initialData?.unknownTime ?? false,
    province: initialData?.province ?? '',
    city: initialData?.city ?? '',
    longitude: initialData?.longitude ?? 120,
    gender: initialData?.gender ?? 'male',
  });

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // 表单状态变化时实时同步给父级（合盘等场景下父级靠这个收集双方数据）
  useEffect(() => {
    onFormSave?.({ ...form });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  const cityList = useMemo(() => {
    const prov = PROVINCES.find(p => p.name === form.province);
    return prov ? prov.cities : [];
  }, [form.province]);

  const branch = useMemo(() => {
    if (form.unknownTime) return 0;
    return calculateTrueSolarTime({
      year: parseInt(form.year), month: parseInt(form.month), day: parseInt(form.day),
      clockHour: parseInt(form.clockHour) || 0, clockMinute: parseInt(form.clockMinute) || 0,
      longitude: form.province ? form.longitude : undefined,
    }).branch;
  }, [form.year, form.month, form.day, form.clockHour, form.clockMinute, form.longitude, form.province, form.unknownTime]);

  const offsetMin = Math.round((form.longitude - 120) * 4);
  const shichenInfo = SHICHEN[branch];

  // ─── 校验逻辑 ───────────────────────────────────────────
  const y = parseInt(form.year) || 0;
  const m = parseInt(form.month) || 0;
  const d = parseInt(form.day) || 0;

  const errors = {
    year: !form.year ? '请选择出生年份'
      : y < 1900 || y > 2026 ? '年份范围：1900–2026'
      : '',
    month: !form.month ? '请选择月份' : '',
    day: !form.day ? '请选择日期'
      : form.year && form.month && !isValidDate(y, m, d) ? `${m}月没有${d}日`
      : '',
  };
  const hasError = Object.values(errors).some(Boolean);

  const handleProvince = (prov: string) => {
    const provData = PROVINCES.find(p => p.name === prov);
    const firstCity = provData?.cities[0];
    setForm({ ...form, province: prov, city: firstCity?.name || '', longitude: firstCity?.longitude ?? 120 });
  };

  const handleCity = (cityName: string) => {
    const prov = PROVINCES.find(p => p.name === form.province);
    const cityData = prov?.cities.find(c => c.name === cityName);
    setForm({ ...form, city: cityName, longitude: cityData?.longitude ?? 120 });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    setTouched({ year: true, month: true, day: true });
    if (hasError) return;
    onFormSave?.({ ...form });
    const clockHour = parseInt(form.clockHour) || 0;
    const clockMinute = parseInt(form.clockMinute) || 0;
    const longitude = form.province ? form.longitude : undefined;
    const solar = calculateTrueSolarTime({ year: y, month: m, day: d, clockHour, clockMinute, longitude });
    const date = form.unknownTime ? { year: y, month: m, day: d }
      : shiftGregorianDate({ year: y, month: m, day: d }, resolveZiweiDayOffset(solar));
    onSubmit({ ...date, hour: form.unknownTime ? 0 : solar.branch, gender: form.gender, timeUnknown: form.unknownTime,
      name: form.name || undefined, province: form.province || undefined, city: form.city || undefined, longitude,
      origInput: form.unknownTime ? undefined : { year: y, month: m, day: d, clockHour, clockMinute } });
  };

  const showErr = (field: string) => touched[field] || submitAttempted;
  const dateFields = [
    { key: 'year' as const, label: '出生年份', placeholder: '年份', values: Array.from({ length: 127 }, (_, i) => 2026 - i), suffix: '' },
    { key: 'month' as const, label: '出生月份', placeholder: '月份', values: Array.from({ length: 12 }, (_, i) => i + 1), suffix: ' 月' },
    { key: 'day' as const, label: '出生日期', placeholder: '日期', values: Array.from({ length: 31 }, (_, i) => i + 1), suffix: ' 日' },
  ];

  return (
    <motion.form className="birth-form" onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <h3 className="birth-form-title">输入生辰八字</h3>
      <div className="birth-form-field">
        <label>姓名（可选）</label>
        <input aria-label="姓名（可选）" type="text" placeholder="请输入姓名" value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="birth-form-field">
        <label>出生日期（公历）</label>
        <div className="birth-form-date">
          {dateFields.map(field => (
            <div key={field.key}>
              <select aria-label={field.label} value={form[field.key]} required
                aria-invalid={!!(showErr(field.key) && errors[field.key])}
                onChange={e => { setForm({ ...form, [field.key]: e.target.value }); setTouched(t => ({ ...t, [field.key]: true })); }}>
                <option value="">{field.placeholder}</option>
                {field.values.map(value => <option key={value} value={String(value)}>{value}{field.suffix}</option>)}
              </select>
              {showErr(field.key) && errors[field.key] && <p className="birth-form-error" role="alert">{errors[field.key]}</p>}
            </div>
          ))}
        </div>
      </div>
      <div className="birth-form-field">
        <label>出生时间（北京时间）</label>
        <div className={`birth-form-time${form.unknownTime ? ' is-disabled' : ''}`}>
          <div className="birth-form-pair">
            <select aria-label="出生小时" disabled={form.unknownTime} value={form.clockHour} onChange={e => setForm({ ...form, clockHour: e.target.value })}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={String(h)}>{String(h).padStart(2, '0')} 时</option>)}
            </select>
            <select aria-label="出生分钟" disabled={form.unknownTime} value={form.clockMinute} onChange={e => setForm({ ...form, clockMinute: e.target.value })}>
              {Array.from({ length: 60 }, (_, min) => <option key={min} value={String(min)}>{String(min).padStart(2, '0')} 分</option>)}
            </select>
          </div>
          <div className="birth-form-readout" aria-live="polite">
            <svg width="64" height="64" viewBox="0 0 72 72" fill="none" aria-hidden="true">
              <circle cx="36" cy="36" r="30" stroke="currentColor" strokeOpacity=".45" />
              <circle cx="36" cy="36" r="22" stroke="currentColor" strokeOpacity=".2" />
              {Array.from({ length: 12 }, (_, i) => <line key={i} x1="36" y1="6" x2="36" y2="9" stroke="currentColor" transform={`rotate(${i * 30} 36 36)`} />)}
              <circle cx="36" cy="6" r="2.5" fill="currentColor" transform={`rotate(${branch * 30} 36 36)`} />
              <text x="36" y="37" textAnchor="middle" dominantBaseline="central" fontSize="18" fontWeight="600" fill="currentColor">{SHICHEN_NAMES[branch]}</text>
            </svg>
            <div><span>{form.province ? '真太阳时' : '北京时间'} → </span><strong>{SHICHEN_NAMES[branch]}时</strong><span>（{shichenInfo?.range}）</span></div>
          </div>
        </div>
        <label className="birth-form-checkbox">
          <input type="checkbox" checked={form.unknownTime} onChange={e => setForm({ ...form, unknownTime: e.target.checked })} />
          <span>不知道出生时间，以子时（23:00–01:00）起盘</span>
        </label>
      </div>
      <div className="birth-form-field">
        <label>出生地点（用于真太阳时校正）</label>
        <div className="birth-form-pair">
          <select aria-label="出生省份或直辖市" value={form.province} onChange={e => handleProvince(e.target.value)}>
            <option value="">省份 / 直辖市</option>
            {PROVINCES.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
          <select aria-label="出生城市" value={form.city} disabled={!form.province} onChange={e => handleCity(e.target.value)}>
            <option value="">{form.province ? '城市' : '先选省份'}</option>
            {cityList.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <AnimatePresence mode="wait">
          <motion.p key={form.province ? 'location' : 'hint'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="birth-form-hint">
            {form.province ? `${form.city} · 经度 ${form.longitude.toFixed(1)}°E · 时差 ${offsetMin > 0 ? '+' : ''}${offsetMin} 分钟` : '填写出生地，自动校正真太阳时'}
          </motion.p>
        </AnimatePresence>
      </div>
      <div className="birth-form-field birth-form-gender-field">
        <label>性别</label>
        <div className="birth-form-pair" role="group" aria-label="性别">
          {(['male', 'female'] as const).map(g => (
            <button key={g} type="button" aria-pressed={form.gender === g}
              className={`birth-form-gender ${g}${form.gender === g ? ' is-on' : ''}`}
              onClick={() => setForm({ ...form, gender: g })}>{g === 'male' ? '♂ 男' : '♀ 女'}</button>
          ))}
        </div>
      </div>
      {!hideSubmit && <button type="submit" className="birth-form-submit" disabled={loading} aria-busy={!!loading}>
        {loading ? '紫微起盘中…' : '立即起盘 · 查看命盘解析'}
      </button>}
    </motion.form>
  );
}
