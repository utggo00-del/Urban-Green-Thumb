// 상태를 바꾸는 순수 로직(lib/*)을 저장소에 연결하는 공용 실행기.
// 먼저 복사본에서 시험 실행해 실패하면 저장하지 않는다(불필요한 저장·화면 갱신 방지).
import type { Res } from '../lib/workflow';
import type { Db } from '../types';
import { repo } from './useDb';

export function run<T>(fn: (db: Db) => Res<T>): Res<T> {
  const dry = fn(structuredClone(repo.getSnapshot()));
  if (!dry.ok) return dry;
  let real: Res<T> = dry;
  repo.update((d) => {
    real = fn(d);
  });
  return real;
}

/** 지금 역할 전환된 사용자의 id */
export const me = () => repo.getSnapshot().session.userId;
