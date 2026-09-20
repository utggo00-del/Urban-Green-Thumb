// 상태를 바꾸는 동작. 검증은 lib/의 순수 함수가 하고, 저장은 repository를 통해서만 한다.
import { buildApplication, canCancel, type ApplicationInput } from '../lib/application';
import { repo } from './useDb';

export type ActionResult<T = undefined> = { ok: true; value?: T } | { ok: false; error: string };

export function submitApplication(input: ApplicationInput): ActionResult<string> {
  const result = buildApplication(repo.getSnapshot(), input);
  if (!result.ok) return result;
  repo.update((d) => {
    d.applications.push(result.application);
  });
  return { ok: true, value: result.application.id };
}

export function cancelApplication(applicationId: string): ActionResult {
  const db = repo.getSnapshot();
  const app = db.applications.find((a) => a.id === applicationId);
  if (!app) return { ok: false, error: '신청을 찾을 수 없습니다.' };
  if (!canCancel(db, app)) return { ok: false, error: '모집이 마감되었거나 추첨이 진행된 신청은 취소할 수 없습니다.' };
  repo.update((d) => {
    d.applications.find((a) => a.id === applicationId)!.status = '취소';
  });
  return { ok: true };
}
