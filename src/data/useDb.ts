import { useSyncExternalStore } from 'react';
import { DEMO_ROLES } from '../config';
import type { Db, DemoRole, User } from '../types';
import { getRepository } from './repository';
import { currentUser } from './selectors';

export const repo = getRepository();

/** 전체 DB 스냅샷을 구독한다. 변경 시 자동 리렌더. */
export function useDb(): Db {
  return useSyncExternalStore(repo.subscribe, repo.getSnapshot);
}

export interface SessionInfo {
  role: DemoRole;
  roleLabel: string;
  user: User;
  isSecretary: boolean;
  /** 오늘(시연 기준일) */
  today: string;
}

export function useSession(): SessionInfo {
  const db = useDb();
  const user = currentUser(db);
  return {
    role: db.session.role,
    roleLabel: DEMO_ROLES[db.session.role].label,
    user,
    isSecretary: !!user.isCommitteeSecretary,
    today: db.meta.today,
  };
}
