import { Check, CircleDot } from 'lucide-react';

/**
 * 진행 단계 표시. 색만이 아니라 아이콘과 글자(“완료/현재/예정”)를 함께 쓰고,
 * 좁은 화면에서는 세로로, 넓은 화면에서는 가로로 배치한다.
 * `current`가 null이면 흐름에서 벗어난 상태라 그리지 않는다.
 */
export function Steps({ labels, current, ariaLabel, failedAt }: { labels: readonly string[]; current: number | null; ariaLabel: string; failedAt?: number }) {
  if (current === null) return null;
  const cols = labels.length === 5 ? 'sm:grid-cols-5' : labels.length === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3';
  return (
    <ol aria-label={ariaLabel} className={`grid gap-1 ${cols}`}>
      {labels.map((label, i) => {
        const done = i < current;
        const now = i === current;
        const bad = failedAt === i && now;
        return (
          <li
            key={label}
            aria-current={now ? 'step' : undefined}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-base font-bold sm:flex-col sm:gap-1 sm:px-1 sm:text-center sm:text-sm ${
              bad ? 'bg-red-100 text-red-700' : now ? 'bg-leaf-700 text-white' : done ? 'bg-leaf-100 text-leaf-800' : 'bg-soil-100 text-soil-700'
            }`}
          >
            {done ? <Check aria-hidden className="size-4" /> : now ? <CircleDot aria-hidden className="size-4" /> : <span aria-hidden className="size-4" />}
            <span className="sr-only">{done ? '완료: ' : now ? '현재: ' : '예정: '}</span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}
