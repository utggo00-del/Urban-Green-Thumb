import { Legend, Swatch, useTip } from './ChartKit';

/**
 * 가로 막대(단일 계열): 이름 없는 범주의 크기 비교. 모든 막대는 같은 색 하나를 쓴다.
 * 막대 두께 20px(≤24), 데이터 끝만 4px 둥글고 기준선(왼쪽)은 직각, 값은 막대 끝에 글자로 표기한다.
 */
export interface BarRow {
  key: string;
  label: string;
  /** 라벨 아래 보조 설명(예: 텃밭 3곳) */
  sub?: string;
  value: number;
  /** 값 글자 (없으면 숫자) */
  valueText?: string;
  /** 툴팁 */
  tip?: string;
}

export function HBarChart({ rows, ariaLabel, color = 'var(--color-viz-1)', max }: { rows: BarRow[]; ariaLabel: string; color?: string; max?: number }) {
  const { bind, node } = useTip();
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <>
      <ul aria-label={ariaLabel} className="space-y-1">
        {rows.map((r) => (
          <li key={r.key} {...bind(r.tip ?? `${r.label}: ${r.valueText ?? r.value}`)} className="grid min-h-11 grid-cols-[6.5rem_1fr] items-center gap-x-3 rounded-lg sm:grid-cols-[8rem_1fr]">
            <span className="text-sm leading-tight">
              <span className="font-bold">{r.label}</span>
              {r.sub && <span className="muted block">{r.sub}</span>}
            </span>
            <span className="flex items-center gap-2 border-l border-soil-200 py-1">
              <span aria-hidden className="block h-5 rounded-r-[4px]" style={{ width: `${(r.value / top) * 78}%`, minWidth: r.value > 0 ? 4 : 0, background: color }} />
              <span className="text-sm font-bold">{r.valueText ?? r.value}</span>
            </span>
          </li>
        ))}
      </ul>
      {node}
    </>
  );
}

export interface StackSeries {
  key: string;
  label: string;
  color: string;
  /** 조각 안에 쓰는 글자색: 조각 색과 대비가 4.5:1 이상인 흰색 또는 짙은 잉크. 없으면 조각 안에 값을 쓰지 않는다(값은 아래 글자·표 보기에 있다). */
  ink?: string;
}

export interface StackRow {
  key: string;
  label: string;
  sub?: string;
  values: Record<string, number>;
  /** 행 아래에 보여 줄 요약 글자 */
  note?: string;
}

/**
 * 가로 누적 막대: 전체 중 각 몫(부분-전체). 행마다 전체 길이가 크기를 나타내도록 가장 큰 행을 100%로 맞춘다.
 * 조각 사이는 2px 표면색 간격으로 구분하고(테두리 없음), 조각 안 글자는 들어갈 만큼 넓을 때만 쓴다.
 * 모든 조각의 값은 막대 아래 글자(색 견본 + 이름 + 값)로 항상 표기한다.
 */
export function StackedBars({ rows, series, ariaLabel }: { rows: StackRow[]; series: StackSeries[]; ariaLabel: string }) {
  const { bind, node } = useTip();
  const totals = rows.map((r) => series.reduce((s, x) => s + (r.values[x.key] ?? 0), 0));
  const top = Math.max(1, ...totals);
  return (
    <div className="space-y-3">
      <Legend items={series} />
      <ul aria-label={ariaLabel} className="space-y-4">
        {rows.map((r, i) => {
          const total = totals[i];
          const width = (total / top) * 100;
          return (
            <li key={r.key} className="space-y-1">
              <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <span>
                  <strong>{r.label}</strong> {r.sub && <span className="muted">{r.sub}</span>}
                </span>
                <span className="font-bold">신청 {total}건</span>
              </p>
              <div className="flex h-6 gap-0.5 border-l border-soil-200" style={{ width: `${Math.max(width, total > 0 ? 4 : 0)}%` }}>
                {series.map((s, k) => {
                  const v = r.values[s.key] ?? 0;
                  if (v === 0) return null;
                  const isLast = series.slice(k + 1).every((x) => (r.values[x.key] ?? 0) === 0);
                  const pct = (v / total) * width; // 화면 전체 폭 대비 조각의 비율
                  return (
                    <span
                      key={s.key}
                      {...bind(`${r.label} · ${s.label} ${v}건 (${Math.round((v / total) * 100)}%)`)}
                      className={`grid min-w-[3px] place-items-center text-sm font-bold ${isLast ? 'rounded-r-[4px]' : ''}`}
                      style={{ flexGrow: v, flexBasis: 0, background: s.color, color: s.ink }}
                    >
                      {pct >= 12 && s.ink ? v : ''}
                    </span>
                  );
                })}
              </div>
              <ul className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm" aria-label={`${r.label} 구성`}>
                {series
                  .filter((s) => (r.values[s.key] ?? 0) > 0)
                  .map((s) => (
                    <li key={s.key} className="flex items-center gap-1.5">
                      <Swatch color={s.color} /> {s.label} <strong>{r.values[s.key]}</strong>
                    </li>
                  ))}
              </ul>
              {r.note && <p className="muted text-sm">{r.note}</p>}
            </li>
          );
        })}
      </ul>
      {node}
    </div>
  );
}
