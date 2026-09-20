// 관리자 통계 집계 (SPEC 3.2-9). 순수 함수 — Db 스냅샷만 읽는다.
import { isPublished, seasonKeyOf } from '../data/selectors';
import type { Db, OrdinanceType, OwnerKind, PriorityKind, SeasonKey } from '../types';

export interface SeasonStat {
  season: SeasonKey;
  /** 취소를 뺀 신청 건수 (한 시즌 1인 1건이므로 신청자 수와 같다) */
  applicants: number;
  /** 추첨으로 구획을 받은 신청: 당첨 + 수락 + 포기(받았다가 포기·기한 경과) */
  assigned: number;
  accepted: number;
  declined: number;
  waiting: number;
  lost: number;
  /** 아직 추첨 결과가 나지 않은 신청 (접수·추첨대기) */
  pending: number;
  plotsOffered: number;
  /** 배정률 = 배정 / 추첨 결과가 난 신청. 추첨 전이면 null */
  assignedRate: number | null;
  /** 경쟁률 = 신청 / 모집 구획. 모집 구획이 없으면 null */
  competition: number | null;
  proxyApplications: number;
}

export const ratio = (num: number, den: number): number | null => (den > 0 ? num / den : null);
export const percent = (r: number | null, digits = 0): string => (r === null ? '-' : `${(r * 100).toFixed(digits)}%`);

export function seasonStats(db: Db): SeasonStat[] {
  const seasons = [...new Set([...db.recruitments.map(seasonKeyOf), ...db.applications.map((a) => a.recruitmentSeason)])].sort();
  return seasons.map((season) => {
    const apps = db.applications.filter((a) => a.recruitmentSeason === season && a.status !== '취소');
    const count = (...st: string[]) => apps.filter((a) => st.includes(a.status)).length;
    const accepted = count('수락');
    const declined = count('포기');
    const assigned = count('당첨') + accepted + declined;
    const waiting = count('대기');
    const lost = count('낙첨');
    const pending = count('접수', '추첨대기');
    const plotsOffered = db.recruitments.filter((r) => seasonKeyOf(r) === season).reduce((s, r) => s + r.plotsOffered, 0);
    return {
      season, applicants: apps.length, assigned, accepted, declined, waiting, lost, pending, plotsOffered,
      assignedRate: ratio(assigned, assigned + waiting + lost),
      competition: ratio(apps.length, plotsOffered),
      proxyApplications: apps.filter((a) => a.appliedBy === '관리자대리').length,
    };
  });
}

export interface TypeStats {
  owner: { kind: OwnerKind; gardens: number; plots: number }[];
  ordinance: { type: OrdinanceType; gardens: number }[];
  total: number;
}

/** 위원회 심의를 거쳐 지정된(공개된) 텃밭 기준 */
export function typeStats(db: Db): TypeStats {
  const gs = db.gardens.filter(isPublished);
  const kinds: OwnerKind[] = ['공공', '민간', '개인'];
  const types: OrdinanceType[] = ['도시텃밭', '상자텃밭', '학습·생태체험텃밭'];
  return {
    owner: kinds.map((kind) => ({ kind, gardens: gs.filter((g) => g.type === kind).length, plots: gs.filter((g) => g.type === kind).reduce((s, g) => s + g.plotCount, 0) })),
    ordinance: types.map((type) => ({ type, gardens: gs.filter((g) => g.ordinanceType === type).length })),
    total: gs.length,
  };
}

export interface DongStat {
  dong: string;
  gardens: number;
  plots: number;
}

/** 행정동별 지정 텃밭 수와 구획 수 (구획 수가 많은 순) */
export function dongStats(db: Db): DongStat[] {
  const map = new Map<string, DongStat>();
  for (const g of db.gardens.filter(isPublished)) {
    const d = map.get(g.dong) ?? { dong: g.dong, gardens: 0, plots: 0 };
    d.gardens += 1;
    d.plots += g.plotCount;
    map.set(g.dong, d);
  }
  return [...map.values()].sort((a, b) => b.plots - a.plots || a.dong.localeCompare(b.dong, 'ko'));
}

export interface PriorityStats {
  season: SeasonKey;
  total: number;
  priority: number;
  share: number | null;
  byKind: { kind: PriorityKind; count: number }[];
  verified: number;
  unverified: number;
}

/** 우선 배정 대상(자기신고) 비율 */
export function priorityStats(db: Db, season: SeasonKey): PriorityStats {
  const apps = db.applications.filter((a) => a.recruitmentSeason === season && a.status !== '취소');
  const pr = apps.filter((a) => a.priorityType !== '없음');
  const kinds: PriorityKind[] = ['다자녀', '취약계층', '노인'];
  return {
    season,
    total: apps.length,
    priority: pr.length,
    share: ratio(pr.length, apps.length),
    byKind: kinds.map((kind) => ({ kind, count: pr.filter((a) => a.priorityType === kind).length })),
    verified: pr.filter((a) => a.priorityVerified).length,
    unverified: pr.filter((a) => !a.priorityVerified).length,
  };
}
