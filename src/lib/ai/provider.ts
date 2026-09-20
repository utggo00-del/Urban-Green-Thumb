// AI 공급자 계층 (SPEC 9장). 화면은 이 인터페이스만 알고, 안에서 무엇이 답을 만드는지는 모른다.
//
//  · 지금은 규칙 기반 “모의 공급자”만 있다. API 키가 없어도 항상 동작한다.
//  · 실제 AI 모델로 바꿀 때는 AiProvider를 구현한 공급자를 만들어 getAiProvider()에서 withFallback()으로 감싸면,
//    호출이 실패해도 모의 답변으로 자동 대체된다.
//  · 주의: 이 앱은 정적 프런트엔드라 API 키를 코드에 넣으면 배포본에 그대로 노출된다. 실서비스에서는 키를 서버에 두고
//    서버(프록시)를 거쳐 호출한다.
import type { Db } from '../../types';
import { buildInsights, type InsightReport } from './insights';
import { recommend, type HelperInput, type HelperResult } from './recommend';

/** 모든 AI 답변 아래에 붙이는 문구 (SPEC 9장) */
export const AI_DISCLAIMER = 'AI가 제공하는 참고 정보이며 정확한 내용은 텃밭지원과(가칭)에 문의해 주세요.';

export interface AiResponse<T> {
  data: T;
  /** 답을 만든 공급자 이름 */
  provider: string;
  /** 규칙 기반 모의 답변인지 */
  isMock: boolean;
  /** 실제 공급자가 실패해서 모의 답변으로 대체됐는지 */
  fellBack: boolean;
}

export interface AiProvider {
  id: string;
  label: string;
  isMock: boolean;
  recommend(db: Db, input: HelperInput): Promise<AiResponse<HelperResult>>;
  insights(db: Db): Promise<AiResponse<InsightReport>>;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 규칙 기반 모의 공급자. delayMs는 “생각하는 중” 로딩 상태를 보여 주기 위한 짧은 대기다. */
export function createMockProvider(delayMs = 600): AiProvider {
  const wrap = <T,>(data: T): AiResponse<T> => ({ data, provider: '규칙 기반 모의 AI', isMock: true, fellBack: false });
  return {
    id: 'mock',
    label: '규칙 기반 모의 AI',
    isMock: true,
    async recommend(db, input) {
      await sleep(delayMs);
      return wrap(recommend(db, input));
    },
    async insights(db) {
      await sleep(delayMs);
      return wrap(buildInsights(db));
    },
  };
}

/** 주 공급자가 오류를 내면(키 없음·네트워크 오류·시간 초과 등) 모의 공급자의 답으로 대체한다. */
export function withFallback(primary: AiProvider, fallback: AiProvider = createMockProvider()): AiProvider {
  return {
    id: `${primary.id}+fallback`,
    label: primary.label,
    isMock: primary.isMock,
    async recommend(db, input) {
      try {
        return await primary.recommend(db, input);
      } catch {
        return { ...(await fallback.recommend(db, input)), fellBack: true };
      }
    },
    async insights(db) {
      try {
        return await primary.insights(db);
      } catch {
        return { ...(await fallback.insights(db)), fellBack: true };
      }
    },
  };
}

let current: AiProvider | null = null;
/** 앱에서 쓰는 공급자. 실제 AI를 연결하려면 여기서 withFallback(realProvider)를 돌려주면 된다. */
export function getAiProvider(): AiProvider {
  return (current ??= createMockProvider());
}
