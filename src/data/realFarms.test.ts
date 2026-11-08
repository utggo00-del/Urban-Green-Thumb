import { describe, expect, it } from 'vitest';
import { REAL_FARMS, getRealFarm } from './realFarms';
import { buildSeed } from './seed';

describe('시흥시 실제 운영 텃밭 데이터', () => {
  it('텃밭 분양 19곳이 있고, id와 이름이 겹치지 않는다', () => {
    expect(REAL_FARMS).toHaveLength(19);
    expect(new Set(REAL_FARMS.map((f) => f.id)).size).toBe(19);
    expect(new Set(REAL_FARMS.map((f) => f.name)).size).toBe(19);
    expect(REAL_FARMS.filter((f) => f.operator === '공영')).toHaveLength(3);
  });

  it('모든 좌표가 시흥시 범위 안에 있고, 출처 링크가 있다', () => {
    for (const f of REAL_FARMS) {
      expect(f.lat, f.name).toBeGreaterThan(37.33);
      expect(f.lat, f.name).toBeLessThan(37.48);
      expect(f.lng, f.name).toBeGreaterThan(126.7);
      expect(f.lng, f.name).toBeLessThan(126.9);
      expect(f.address.startsWith('경기도 시흥시'), f.name).toBe(true);
      expect(f.sourceUrl.startsWith('https://jumalfarm.com/farm/'), f.name).toBe(true);
    }
  });

  it('구획 넓이는 평·㎡가 함께 있고 서로 맞는다', () => {
    for (const f of REAL_FARMS.filter((x) => x.plotPyeong !== undefined)) {
      expect(f.plotM2, f.name).toBeDefined();
      expect(Math.abs(f.plotM2! - f.plotPyeong! * 3.3058), f.name).toBeLessThan(1.5);
    }
  });

  it('가상 텃밭(시드)과 id가 겹치지 않아 신청·추첨 흐름에 섞이지 않는다', () => {
    const gardenIds = new Set(buildSeed().gardens.map((g) => g.id));
    expect(REAL_FARMS.some((f) => gardenIds.has(f.id))).toBe(false);
    expect(getRealFarm('g01')).toBeUndefined();
  });
});
