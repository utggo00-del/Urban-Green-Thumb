import { Bot, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AI_DISCLAIMER, type AiResponse } from '../lib/ai/provider';
import { Badge } from './Badge';

/** 모든 AI 답변 아래에 붙이는 안내: 참고 정보라는 문구와, 모의 답변·폴백 여부 */
export function AiNote({ res }: { res: Pick<AiResponse<unknown>, 'isMock' | 'fellBack' | 'provider'> | null }) {
  return (
    <div className="space-y-1 rounded-xl bg-soil-100 p-3 text-sm">
      <p className="flex flex-wrap items-center gap-2 font-bold">
        <Bot aria-hidden className="size-4" /> {AI_DISCLAIMER}
      </p>
      {res && (
        <p className="muted">
          {res.isMock ? '이 답변은 API 키 없이 동작하는 규칙 기반 모의 AI가 만들었어요.' : `${res.provider}가 만든 답변이에요.`}
          {res.fellBack && ' AI 연결에 실패해 모의 답변으로 대신 보여 드려요.'}
        </p>
      )}
    </div>
  );
}

export function AiBadge() {
  return (
    <Badge tone="info">
      <Bot aria-hidden className="size-4" /> AI (시연용 모의)
    </Badge>
  );
}

export type AiState<T> = { status: 'idle' } | { status: 'loading' } | { status: 'error'; message: string } | { status: 'done'; res: AiResponse<T> };

/**
 * AI 공급자를 부르는 훅. 로딩·오류·완료 상태를 모두 다루고, 화면을 벗어났거나 새 요청이 시작되면 이전 응답은 버린다.
 */
export function useAi<T>() {
  const [state, setState] = useState<AiState<T>>({ status: 'idle' });
  const seq = useRef(0);

  useEffect(() => () => void (seq.current = -1), []);

  const run = useCallback(async (fn: () => Promise<AiResponse<T>>) => {
    const my = ++seq.current;
    setState({ status: 'loading' });
    try {
      const res = await fn();
      if (seq.current === my) setState({ status: 'done', res });
    } catch (e) {
      if (seq.current === my) setState({ status: 'error', message: e instanceof Error ? e.message : '알 수 없는 오류' });
    }
  }, []);

  return { state, run };
}

export function AiLoading({ text }: { text: string }) {
  return (
    <p role="status" className="flex items-center gap-2 rounded-xl bg-leaf-50 p-4 font-bold text-leaf-800">
      <Loader2 aria-hidden className="size-5 animate-spin" /> {text}
    </p>
  );
}
