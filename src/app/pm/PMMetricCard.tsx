'use client';
import { useEffect, useState, type CSSProperties } from 'react';

type MetricKind = 'plans' | 'pending' | 'overdue' | 'completed';
const icons: Record<MetricKind, string> = {
  plans: 'M8 3v4M16 3v4M4 10h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1ZM8 14h3M8 17h6',
  pending: 'M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  overdue: 'm12 3 10 18H2L12 3ZM12 9v5M12 17v.5',
  completed: 'm8 12 3 3 5-6M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
};

export default function PMMetricCard({ label, value, kind, index }: {
  label: string; value: number; kind: MetricKind; index: number;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const finish = () => { cancelAnimationFrame(frame); setDisplay(value); };
    const onPreference = () => { if (preference.matches) finish(); };
    preference.addEventListener('change', onPreference);
    if (preference.matches) finish();
    else {
      setDisplay(0);
      const from = 0;
      const start = performance.now() + index * 90;
      const tick = (now: number) => {
        const progress = Math.max(0, Math.min(1, (now - start) / 1200));
        const next = Math.round(from + (value - from) * (1 - Math.pow(1 - progress, 3)));
        setDisplay(next);
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }
    return () => { cancelAnimationFrame(frame); preference.removeEventListener('change', onPreference); };
  }, [value, index]);
  return <article className={`pm-metric pm-metric-${kind}`} style={{ '--pm-delay': `${index * 70}ms` } as CSSProperties}>
    <span className="pm-metric-label">{label}</span>
    <span className="pm-metric-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={icons[kind]} /></svg></span>
    <strong aria-label={`${label} ${value.toLocaleString('th-TH')} รายการ`}><span aria-hidden="true">{display.toLocaleString('th-TH')}</span></strong>
  </article>;
}
