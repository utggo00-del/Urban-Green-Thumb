// 텃밭 찾기용 조회·필터 (순수 함수). 화면은 이 결과만 그린다.
import { currentSeasonKey, isPublished, recruitmentsOf } from '../data/selectors';
import type { Db, Garden, OrdinanceType, OwnerKind, Recruitment, RecruitmentStatus } from '../types';

export type AreaBucket = '전체' | 'small' | 'medium' | 'large';
export type FeeFilter = 'all' | 'free' | 'paid';
export type RecruitFilter = '전체' | RecruitmentStatus | '모집 없음';

export interface GardenFilter {
  owner: OwnerKind | '전체';
  ordinance: OrdinanceType | '전체';
  dong: string | '전체';
  /** 구획 1개의 면적 기준 */
  area: AreaBucket;
  fee: FeeFilter;
  recruit: RecruitFilter;
}

export const EMPTY_FILTER: GardenFilter = { owner: '전체', ordinance: '전체', dong: '전체', area: '전체', fee: 'all', recruit: '전체' };

export const AREA_BUCKETS: { value: AreaBucket; label: string; test: (m2: number) => boolean }[] = [
  { value: '전체', label: '전체', test: () => true },
  { value: 'small', label: '작은 구획 (11㎡ 이하)', test: (m2) => m2 <= 11 },
  { value: 'medium', label: '보통 구획 (12~13㎡)', test: (m2) => m2 >= 12 && m2 <= 13 },
  { value: 'large', label: '넓은 구획 (14㎡ 이상)', test: (m2) => m2 >= 14 },
];

/** 화면용으로 계산해 둔 텃밭 요약 */
export interface GardenView {
  garden: Garden;
  /** 현재 시즌 모집 (없으면 undefined) */
  recruitment?: Recruitment;
  /** 잔여(공실) 구획 수 */
  vacant: number;
  /** 현재 시즌에 이 텃밭을 지망한 신청자 수 (접수·추첨대기 등 유효한 신청) */
  applicants: number;
}

export function toGardenView(db: Db, garden: Garden): GardenView {
  const season = currentSeasonKey(db);
  const recruitment = recruitmentsOf(db, season).find((r) => r.gardenId === garden.id);
  return {
    garden,
    recruitment,
    vacant: db.plots.filter((p) => p.gardenId === garden.id && p.status === '공실').length,
    applicants: db.applications.filter(
      (a) => a.recruitmentSeason === season && a.status !== '취소' && a.status !== '포기' && a.choices.includes(garden.id),
    ).length,
  };
}

/** 위원회 심의를 거쳐 지정된 텃밭만 대상으로 한다 (SPEC 3.1-2, 5.6). */
export function publishedViews(db: Db): GardenView[] {
  return db.gardens.filter(isPublished).map((g) => toGardenView(db, g));
}

export function applyFilter(views: GardenView[], f: GardenFilter): GardenView[] {
  const bucket = AREA_BUCKETS.find((b) => b.value === f.area)!;
  return views.filter(({ garden: g, recruitment }) => {
    if (f.owner !== '전체' && g.type !== f.owner) return false;
    if (f.ordinance !== '전체' && g.ordinanceType !== f.ordinance) return false;
    if (f.dong !== '전체' && g.dong !== f.dong) return false;
    if (!bucket.test(g.plotAreaM2)) return false;
    if (f.fee === 'free' && g.fee !== 0) return false;
    if (f.fee === 'paid' && g.fee === 0) return false;
    if (f.recruit === '모집 없음') return !recruitment;
    if (f.recruit !== '전체') return recruitment?.status === f.recruit;
    return true;
  });
}

export function activeFilterCount(f: GardenFilter): number {
  return (Object.keys(EMPTY_FILTER) as (keyof GardenFilter)[]).filter((k) => f[k] !== EMPTY_FILTER[k]).length;
}

/** 모집 중인 텃밭이 먼저, 그다음 이름순 */
export function sortViews(views: GardenView[]): GardenView[] {
  const rank = (v: GardenView) => (v.recruitment?.status === '모집중' ? 0 : v.recruitment ? 1 : 2);
  return views.slice().sort((a, b) => rank(a) - rank(b) || a.garden.name.localeCompare(b.garden.name, 'ko'));
}

export const dongsOf = (views: GardenView[]) => [...new Set(views.map((v) => v.garden.dong))].sort((a, b) => a.localeCompare(b, 'ko'));

/** ㎡ → 평 (표시용) */
export const toPyeong = (m2: number) => Math.round((m2 / 3.3058) * 10) / 10;
