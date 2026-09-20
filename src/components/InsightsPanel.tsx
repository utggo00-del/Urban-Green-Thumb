import { ChevronRight, RefreshCw, Sparkles } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAiProvider } from '../lib/ai/provider';
import type { InsightLevel, InsightReport } from '../lib/ai/insights';
import { useDb } from '../data/useDb';
import { AiBadge, AiLoading, AiNote, useAi } from './AiNote';
import { Badge, Notice } from './Badge';

const LEVEL = {
  action: { tone: 'danger', label: '바로 처리' },
  notice: { tone: 'warn', label: '살펴보기' },
  good: { tone: 'success', label: '양호' },
} as const satisfies Record<InsightLevel, { tone: 'danger' | 'warn' | 'success'; label: string }>;

/** 관리자 인사이트 요약 (SPEC 9-3): 신청·배정 데이터를 읽어 “다음 시즌 어느 동에 텃밭이 부족한가” 같은 문장으로 알려 준다. */
export function InsightsPanel() {
  const db = useDb();
  const { state, run } = useAi<InsightReport>();
  const generate = () => void run(() => getAiProvider().insights(db));

  // 처음 열 때 한 번 자동으로 만들어 준다. 이후 데이터가 바뀌면 “다시 분석하기”로 갱신한다.
  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section aria-labelledby="ai-insights" className="card space-y-4 border-leaf-700">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="ai-insights" className="flex flex-wrap items-center gap-2 text-lg font-extrabold">
            <Sparkles aria-hidden className="size-5 text-leaf-700" /> 인사이트 요약 <AiBadge />
          </h2>
          <p className="muted text-sm">신청·배정·심의 데이터를 읽어 지금 살펴볼 점을 정리해요.</p>
        </div>
        <button type="button" className="btn btn-secondary !min-h-11" onClick={generate} disabled={state.status === 'loading'}>
          <RefreshCw aria-hidden className={`size-4 ${state.status === 'loading' ? 'animate-spin' : ''}`} /> 다시 분석하기
        </button>
      </div>

      <div aria-live="polite" className="space-y-4">
        {state.status === 'loading' && <AiLoading text="데이터를 분석하고 있어요…" />}
        {state.status === 'error' && (
          <Notice tone="danger">
            <p className="font-bold">인사이트를 만들지 못했어요.</p>
            <p className="text-sm">{state.message} · “다시 분석하기”를 눌러 다시 시도해 주세요. 통계 차트는 그대로 볼 수 있어요.</p>
          </Notice>
        )}
        {state.status === 'done' && (
          <>
            <p className="rounded-xl bg-leaf-50 p-4 text-lg leading-relaxed">{state.res.data.summary}</p>
            <ul className="space-y-3">
              {state.res.data.insights.map((i) => (
                <li key={i.id} className="rounded-xl border border-soil-200 p-3">
                  <p className="flex flex-wrap items-center gap-2 font-extrabold">
                    <Badge tone={LEVEL[i.level].tone}>{LEVEL[i.level].label}</Badge> {i.title}
                  </p>
                  <p className="mt-1">{i.detail}</p>
                  {i.link && (
                    <Link to={i.link.to} className="mt-1 inline-flex min-h-11 items-center gap-1 font-bold">
                      {i.link.label} <ChevronRight aria-hidden className="size-4" />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
            <AiNote res={state.res} />
          </>
        )}
      </div>
    </section>
  );
}
