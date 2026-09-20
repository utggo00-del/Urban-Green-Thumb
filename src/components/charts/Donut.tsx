import { useState } from 'react';
import { Swatch } from './ChartKit';

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

const R = 46;
const C = 2 * Math.PI * R;
const GAP = 3; // 조각 사이 간격 (표면색 간격 대신 호 길이를 비운다)

/**
 * 도넛: 부분-전체를 한눈에 (조각 6개 이하, 값이 비슷한 항목끼리 비교하는 용도는 아님).
 * 가운데에 전체(또는 가리킨 조각) 값을 크게 보여 주고, 옆 범례에 이름·값·비율을 모두 글자로 적는다.
 */
export function Donut({ segments, centerLabel, ariaLabel, unit = '곳' }: { segments: DonutSegment[]; centerLabel: string; ariaLabel: string; unit?: string }) {
  const [active, setActive] = useState<string | null>(null);
  const total = segments.reduce((s, x) => s + x.value, 0);
  const shown = segments.find((s) => s.key === active);
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
      <div className="relative size-40 shrink-0">
        <svg viewBox="0 0 120 120" className="size-full -rotate-90" role="img" aria-label={ariaLabel}>
          <circle cx="60" cy="60" r={R} fill="none" stroke="var(--color-viz-grid)" strokeWidth="14" />
          {total > 0 &&
            segments.map((s) => {
              const len = (s.value / total) * C;
              const dash = Math.max(0, len - (segments.filter((x) => x.value > 0).length > 1 ? GAP : 0));
              const el = (
                <circle
                  key={s.key}
                  cx="60"
                  cy="60"
                  r={R}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="14"
                  strokeDasharray={`${dash} ${C - dash}`}
                  strokeDashoffset={-offset}
                  opacity={active && active !== s.key ? 0.35 : 1}
                />
              );
              offset += len;
              return s.value > 0 ? el : null;
            })}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-3xl font-extrabold leading-none">{shown ? shown.value : total}</p>
            <p className="muted mt-1 max-w-[5.5rem] text-sm leading-tight">{shown ? shown.label : centerLabel}</p>
          </div>
        </div>
      </div>

      <ul className="w-full space-y-1" aria-label={`${ariaLabel} 범례`}>
        {segments.map((s) => (
          <li
            key={s.key}
            tabIndex={0}
            onMouseEnter={() => setActive(s.key)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(s.key)}
            onBlur={() => setActive(null)}
            className="flex min-h-11 items-center gap-2 rounded-lg px-2"
          >
            <Swatch color={s.color} />
            <span className="flex-1 whitespace-nowrap font-bold">{s.label}</span>
            <span>{s.value}{unit}</span>
            <span className="muted w-12 text-right text-sm">{total > 0 ? `${Math.round((s.value / total) * 100)}%` : '-'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
