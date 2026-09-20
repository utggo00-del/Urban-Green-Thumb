// 화면에서 자주 쓰는 조회 함수 (순수 함수 — Db 스냅샷만 읽는다).
import type { Application, Db, Garden, Meeting, Notice, Recruitment, SeasonKey, User } from '../types';

export const seasonKeyOf = (r: Pick<Recruitment, 'year' | 'season'>): SeasonKey => `${r.year}-${r.season}`;

/** 지금 모집 시즌 (모집 중이거나 준비 중인 가장 최근 시즌) */
export function currentSeasonKey(db: Db): SeasonKey {
  const open = db.recruitments.filter((r) => r.status === '모집중' || r.status === '준비' || r.status === '마감');
  const latest = (open.length ? open : db.recruitments).map(seasonKeyOf).sort().at(-1);
  return latest ?? `${Number(db.meta.today.slice(0, 4))}-가을`;
}

export const getUser = (db: Db, id: string): User | undefined => db.users.find((u) => u.id === id);
export const currentUser = (db: Db): User => getUser(db, db.session.userId) ?? db.users[0];
export const getGarden = (db: Db, id: string): Garden | undefined => db.gardens.find((g) => g.id === id);

/** 위원회 심의를 거쳐 지정된 텃밭만 시민에게 공개한다 (SPEC 5.6). */
export const isPublished = (g: Garden) => g.status === '지정' || g.status === '운영중';
export const publishedGardens = (db: Db) => db.gardens.filter(isPublished);

export const recruitmentsOf = (db: Db, season: SeasonKey) =>
  db.recruitments.filter((r) => seasonKeyOf(r) === season);
export const openRecruitments = (db: Db) =>
  recruitmentsOf(db, currentSeasonKey(db)).filter((r) => r.status === '모집중');

export const myApplication = (db: Db, userId: string, season: SeasonKey): Application | undefined =>
  db.applications.find((a) => a.userId === userId && a.recruitmentSeason === season && a.status !== '취소');

export const gardensOwnedBy = (db: Db, userId: string) => db.gardens.filter((g) => g.ownerId === userId);

/** 오늘 이후 가장 가까운 위원회 회의 (예정·진행중) */
export function nextMeeting(db: Db): Meeting | undefined {
  return db.meetings
    .filter((m) => m.status !== '종료' && m.scheduledAt.slice(0, 10) >= db.meta.today)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];
}

export function noticesFor(db: Db, audience: Notice['audience'] | 'all'): Notice[] {
  return db.notices
    .filter((n) => audience === 'all' || n.audience === '전체' || n.audience === audience)
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.createdAt.localeCompare(a.createdAt));
}
