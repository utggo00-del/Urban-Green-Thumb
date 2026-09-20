// 통계 차트 공용 부품. 순수 HTML/SVG라 가볍고, 값은 언제나 글자로도 읽을 수 있으며(표 보기 포함) 툴팁은 보조 수단이다.
import { useState, type FocusEvent, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Tip {
  text: string;
  x: number;
  y: number;
}

/**
 * 마우스를 올리거나(hover) 키보드로 초점을 옮기면(focus) 같은 설명이 뜨는 툴팁.
 * 툴팁만이 유일한 정보원이 아니도록 값은 항상 화면 글자와 표 보기에도 있다.
 */
export function useTip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const bind = (text: string) => ({
    tabIndex: 0,
    onMouseMove: (e: MouseEvent) => setTip({ text, x: e.clientX, y: e.clientY }),
    onMouseLeave: () => setTip(null),
    onFocus: (e: FocusEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      setTip({ text, x: r.left + Math.min(r.width, 240) / 2, y: r.top });
    },
    onBlur: () => setTip(null),
  });
  const node = tip
    ? createPortal(
        <div
          role="tooltip"
          style={{ position: 'fixed', left: Math.min(Math.max(tip.x, 110), window.innerWidth - 110), top: tip.y - 12, transform: 'translate(-50%, -100%)', zIndex: 60 }}
          className="pointer-events-none max-w-[13rem] rounded-lg bg-ink px-3 py-2 text-center text-sm font-bold leading-snug text-cream shadow-lg"
        >
          {tip.text}
        </div>,
        document.body,
      )
    : null;
  return { bind, node };
}

export interface TableTwin {
  caption: string;
  head: string[];
  rows: (string | number)[][];
}

/** 차트 카드: 제목·설명·차트·표 보기(접근 가능한 대체 표현) */
export function ChartCard({ title, subtitle, children, table, className = '' }: { title: string; subtitle?: string; children: ReactNode; table?: TableTwin; className?: string }) {
  const id = title.replace(/\s+/g, '-');
  return (
    <section aria-labelledby={id} className={`card space-y-4 ${className}`}>
      <div>
        <h2 id={id} className="text-lg font-extrabold">
          {title}
        </h2>
        {subtitle && <p className="muted text-sm">{subtitle}</p>}
      </div>
      {children}
      {table && (
        <details>
          <summary className="min-h-11 py-2 text-sm font-bold text-leaf-800">표로 보기</summary>
          <div className="overflow-x-auto" role="region" tabIndex={0} aria-label={table.caption}>
            <table className="w-full min-w-[20rem] text-left text-sm">
              <caption className="sr-only">{table.caption}</caption>
              <thead>
                <tr className="border-b border-soil-200">
                  {table.head.map((h) => (
                    <th key={h} scope="col" className="py-1.5 pr-3 font-bold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={i} className="border-b border-soil-100">
                    {r.map((c, j) => (j === 0 ? <th key={j} scope="row" className="py-1.5 pr-3 font-normal">{c}</th> : <td key={j} className="py-1.5 pr-3">{c}</td>))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}

/** 색 견본 + 글자. 식별은 색 견본이, 글자는 항상 본문 색을 쓴다. */
export function Swatch({ color }: { color: string }) {
  return <span aria-hidden className="inline-block size-3 shrink-0 rounded-full" style={{ background: color }} />;
}

/** 범례: 계열이 2개 이상이면 항상 둔다 */
export function Legend({ items }: { items: { key: string; label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="범례">
      {items.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <Swatch color={s.color} /> {s.label}
        </li>
      ))}
    </ul>
  );
}

/** 하나의 비율(값 ÷ 최대)을 보여 주는 미터. 빈 칸(트랙)은 같은 색의 옅은 단계다. */
export function Meter({ value, max, label, text }: { value: number; max: number; label: string; text: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-valuetext={text} className="h-3 overflow-hidden rounded-full" style={{ background: 'var(--color-viz-track)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--color-viz-1)' }} />
      </div>
      <p className="mt-1 text-sm">{text}</p>
    </div>
  );
}
