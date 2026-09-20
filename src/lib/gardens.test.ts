import { describe, expect, it } from 'vitest';
import { buildSeed } from '../data/seed';
import { EMPTY_FILTER, applyFilter, activeFilterCount, dongsOf, publishedViews, sortViews, toGardenView, toPyeong } from './gardens';

describe('텃밭 찾기', () => {
  const db = buildSeed();
  const all = publishedViews(db);

  it('위원회 심의를 거쳐 지정된 12곳만 노출한다 (심의대기·보류·검수중은 숨김)', () => {
    expect(all).toHaveLength(12);
    const names = all.map((v) => v.garden.name);
    for (const hidden of ['g13', 'g14', 'g15', 'g16']) {
      expect(names).not.toContain(db.gardens.find((g) => g.id === hidden)!.name);
    }
  });

  it('필터 없이는 그대로, 유형별 필터', () => {
    expect(applyFilter(all, EMPTY_FILTER)).toHaveLength(12);
    expect(applyFilter(all, { ...EMPTY_FILTER, owner: '공공' })).toHaveLength(5);
    expect(applyFilter(all, { ...EMPTY_FILTER, owner: '민간' })).toHaveLength(4);
    expect(applyFilter(all, { ...EMPTY_FILTER, owner: '개인' })).toHaveLength(3);
    expect(applyFilter(all, { ...EMPTY_FILTER, ordinance: '상자텃밭' }).map((v) => v.garden.id).sort()).toEqual(['g04', 'g11']);
  });

  it('이용료·행정동·면적·모집 상태 필터', () => {
    expect(applyFilter(all, { ...EMPTY_FILTER, fee: 'free' }).every((v) => v.garden.fee === 0)).toBe(true);
    expect(applyFilter(all, { ...EMPTY_FILTER, fee: 'paid' }).every((v) => v.garden.fee > 0)).toBe(true);
    expect(applyFilter(all, { ...EMPTY_FILTER, dong: '장곡동' }).map((v) => v.garden.id).sort()).toEqual(['g06', 'g12']);
    expect(applyFilter(all, { ...EMPTY_FILTER, area: 'large' }).every((v) => v.garden.plotAreaM2 >= 14)).toBe(true);
    const closed = applyFilter(all, { ...EMPTY_FILTER, recruit: '마감' }).map((v) => v.garden.id).sort();
    expect(closed).toEqual(['g03', 'g06']);
    expect(applyFilter(all, { ...EMPTY_FILTER, recruit: '모집중' })).toHaveLength(8);
    expect(applyFilter(all, { ...EMPTY_FILTER, recruit: '모집 없음' }).map((v) => v.garden.id)).toEqual(['g09']);
  });

  it('필터는 조합(AND)되고, 활성 필터 개수를 센다', () => {
    const f = { ...EMPTY_FILTER, owner: '민간' as const, recruit: '모집중' as const };
    expect(applyFilter(all, f).map((v) => v.garden.id).sort()).toEqual(['g07', 'g08']);
    expect(activeFilterCount(f)).toBe(2);
    expect(activeFilterCount(EMPTY_FILTER)).toBe(0);
  });

  it('요약: 잔여 구획과 지망 신청자 수', () => {
    const g06 = toGardenView(db, db.gardens.find((g) => g.id === 'g06')!);
    expect(g06.vacant).toBe(30 - 4); // 봄 이용자 4명
    expect(g06.recruitment?.status).toBe('마감');
    expect(g06.applicants).toBeGreaterThan(g06.recruitment!.plotsOffered);
  });

  it('정렬: 모집 중이 먼저, 모집 없음이 마지막', () => {
    const sorted = sortViews(all);
    expect(sorted[0].recruitment?.status).toBe('모집중');
    expect(sorted.at(-1)?.recruitment).toBeUndefined();
  });

  it('행정동 목록과 평 환산', () => {
    expect(dongsOf(all)).toContain('정왕동');
    expect(toPyeong(13)).toBe(3.9);
  });
});
