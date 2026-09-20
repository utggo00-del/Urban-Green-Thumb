import { describe, expect, it } from 'vitest';
import { buildSeed } from '../../data/seed';
import { confirmDraw, runDraw } from '../allocation';
import { drawGroups } from '../recruitment';
import { CROPS } from './crops';
import { buildInsights, demandByDong } from './insights';
import { AI_DISCLAIMER, createMockProvider, withFallback, type AiProvider } from './provider';
import { distanceKm, recommend, recommendCrops, type HelperInput } from './recommend';

const db = buildSeed();
const base: HelperInput = { dong: '정왕동', transport: '대중교통', experience: '조금 해봤어요', interests: [], freeOnly: false };
const garden = (id: string) => db.gardens.find((g) => g.id === id)!;

describe('거리 계산', () => {
  it('같은 지점은 0, 정왕동~은행동은 수 km', () => {
    expect(distanceKm([37.3448, 126.7365], [37.3448, 126.7365])).toBe(0);
    const d = distanceKm([37.3448, 126.7365], [37.4415, 126.8012]);
    expect(d).toBeGreaterThan(9);
    expect(d).toBeLessThan(14);
  });
});

describe('텃밭 추천 도우미', () => {
  it('지금 신청할 수 있는(모집 중인 지정) 텃밭만 추천하고, 점수 순으로 3곳', () => {
    const r = recommend(db, base);
    expect(r.gardens).toHaveLength(3);
    expect(r.fallbackToPublished).toBe(false);
    expect(r.gardens.every((g) => g.recruiting)).toBe(true);
    for (const g of recommend(db, base, 30).gardens) {
      expect(['g06', 'g03', 'g05', 'g09', 'g13', 'g14', 'g15', 'g16']).not.toContain(g.gardenId); // 마감·준비·모집 없음·미지정 제외
    }
    expect(r.gardens.map((g) => g.score)).toEqual(r.gardens.map((g) => g.score).slice().sort((a, b) => b - a));
    for (const g of r.gardens) {
      expect(g.score).toBeGreaterThanOrEqual(0);
      expect(g.score).toBeLessThanOrEqual(100);
      expect(g.reasons.length).toBeGreaterThan(0);
    }
  });

  it('같은 입력이면 같은 결과 (재현 가능)', () => {
    expect(recommend(db, base)).toEqual(recommend(db, base));
  });

  it('거주 동 근처 텃밭이 앞선다: 정왕동 도보 → 정왕동 텃밭, 배곧동 도보 → 배곧동 텃밭', () => {
    expect(['g01', 'g10']).toContain(recommend(db, { ...base, transport: '도보' }).gardens[0].gardenId);
    const bae = recommend(db, { ...base, dong: '배곧동', transport: '도보' }).gardens[0];
    expect(['g02', 'g11']).toContain(bae.gardenId);
    expect(bae.reasons.join(' ')).toContain('배곧동');
  });

  it('이동수단: 자가용은 주차 시설을, 휠체어는 접근 시설을 중요하게 본다', () => {
    const car = recommend(db, { ...base, transport: '자가용' }, 12).gardens;
    const parked = car.filter((g) => garden(g.gardenId).facilities.includes('parking'));
    expect(parked.length).toBeGreaterThan(0);
    for (const g of parked) expect(g.reasons.join(' ')).toContain('주차');

    const wheel = recommend(db, { ...base, transport: '휠체어·보행 보조' }, 12).gardens;
    for (const g of wheel) {
      const has = garden(g.gardenId).facilities.includes('wheelchair');
      expect(g.reasons.join(' ').includes('휠체어 접근이 가능')).toBe(has);
      expect(g.cautions.join(' ').includes('휠체어 접근 시설이 없어요')).toBe(!has);
    }
    expect(garden(wheel[0].gardenId).facilities).toContain('wheelchair');
  });

  it('이용료가 없는 텃밭만 원하면 유료 텃밭은 크게 밀려나고 이유가 남는다', () => {
    const list = recommend(db, { ...base, freeOnly: true }, 12).gardens;
    const paid = list.filter((g) => garden(g.gardenId).fee > 0);
    const gratis = list.filter((g) => garden(g.gardenId).fee === 0);
    expect(gratis.length).toBeGreaterThan(0);
    expect(Math.min(...gratis.map((g) => g.score))).toBeGreaterThan(Math.max(...paid.map((g) => g.score)));
    for (const g of paid) expect(g.cautions.join(' ')).toContain('이용료가 있어요');
    expect(list[0].reasons.join(' ')).toContain('이용료가 없어요');
  });

  it('처음이면 작은 구획·상자텃밭·시설을 반기고, 경험이 많으면 넉넉한 구획을 반긴다', () => {
    const newbie = recommend(db, { ...base, experience: '처음이에요' }, 12).gardens.map((g) => g.reasons.join(' ')).join(' | ');
    expect(newbie).toMatch(/처음 시작하기 좋아요|관리 부담이 적어요|급수 시설과 농기구함/);
    const expert = recommend(db, { ...base, experience: '경험이 많아요' }, 12).gardens.map((g) => g.reasons.join(' ')).join(' | ');
    expect(expert).toContain('구획이 넉넉해요');
  });

  it('경쟁이 치열한 텃밭에는 주의 문구가 붙는다', () => {
    const d = structuredClone(db);
    d.recruitments.find((r) => r.gardenId === 'g11')!.plotsOffered = 1; // 3명 신청 vs 1구획
    const g = recommend(d, { ...base, dong: '배곧동', transport: '도보' }, 12).gardens.find((x) => x.gardenId === 'g11')!;
    expect(g.cautions.join(' ')).toContain('경쟁이 치열해요');
  });

  it('모집 중인 텃밭이 없으면 지정 텃밭 전체에서 고르되 안내한다', () => {
    const d = structuredClone(db);
    for (const r of d.recruitments) r.status = '추첨완료';
    const r = recommend(d, base);
    expect(r.fallbackToPublished).toBe(true);
    expect(r.message).toContain('모집 중인 텃밭이 없어서');
    expect(r.gardens.every((g) => !g.recruiting)).toBe(true);
    expect(r.gardens[0].cautions.join(' ')).toContain('모집하지 않는');
  });

  it('지정된 텃밭이 없으면 빈 결과와 안내', () => {
    const d = structuredClone(db);
    for (const g of d.gardens) g.status = '검수중';
    const r = recommend(d, base);
    expect(r.gardens).toHaveLength(0);
    expect(r.message).toContain('지정된 텃밭이 없어요');
  });

  it('알 수 없는 행정동이어도 오류 없이 동작한다', () => {
    expect(recommend(db, { ...base, dong: '없는동' }).gardens).toHaveLength(3);
  });
});

describe('추천 작물', () => {
  it('시즌에 맞는 작물만 (가을에는 감자·토마토 제외, 봄에는 시금치·마늘 제외)', () => {
    const fall = recommendCrops('가을', { interests: [], experience: '경험이 많아요' }, 20).map((c) => c.crop.id);
    expect(fall).toContain('spinach');
    expect(fall).not.toContain('potato');
    expect(fall).not.toContain('tomato');
    const spring = recommendCrops('봄', { interests: [], experience: '경험이 많아요' }, 20).map((c) => c.crop.id);
    expect(spring).toContain('potato');
    expect(spring).not.toContain('spinach');
    expect(spring).not.toContain('garlic');
  });

  it('처음이면 쉬운 작물만, 관심 종류가 앞선다', () => {
    const newbie = recommendCrops('가을', { interests: [], experience: '처음이에요' }, 20);
    expect(newbie.every((c) => c.crop.difficulty === 1)).toBe(true);
    const roots = recommendCrops('가을', { interests: ['뿌리채소'], experience: '처음이에요' }, 4);
    expect(roots[0].crop.group).toBe('뿌리채소');
    expect(roots[0].reasons.join(' ')).toContain('관심 있는 뿌리채소');
  });

  it('작물 정보에는 재배 팁과 시즌이 있고, 화학 자재를 권하지 않는다 (조례 제3조 취지)', () => {
    for (const c of CROPS) {
      expect(c.tip.length).toBeGreaterThan(10);
      expect(c.seasons.length).toBeGreaterThan(0);
      expect(c.tip).not.toMatch(/농약|화학비료/);
    }
  });

  it('추천 결과에 이번 시즌 작물이 들어 있다', () => {
    const r = recommend(db, { ...base, experience: '처음이에요', interests: ['잎채소'] });
    expect(r.season).toBe('가을');
    expect(r.crops.length).toBeGreaterThan(0);
    expect(r.crops[0].crop.group).toBe('잎채소');
  });
});

describe('관리자 인사이트', () => {
  const r = buildInsights(db);
  const byId = (id: string) => r.insights.find((i) => i.id === id);

  it('행정동별 수요와 공급을 비교한다 (대야동: 신청자는 있는데 지정 텃밭이 없다)', () => {
    const rows = demandByDong(db, '2026-가을');
    const daeya = rows.find((x) => x.dong === '대야동')!;
    expect(daeya.gardens).toBe(0);
    expect(daeya.applicants).toBeGreaterThanOrEqual(3);
    expect(byId('no-garden-대야동')).toMatchObject({ level: 'action' });
    expect(byId('no-garden-대야동')!.detail).toContain('신청자 중');
    expect(rows.reduce((s, x) => s + x.applicants, 0)).toBeGreaterThan(50);
  });

  it('경쟁이 치열한 텃밭과 우선 배정 확인 대기를 알려준다', () => {
    expect(byId('hot-g06')?.detail).toContain('18명');
    expect(byId('priority')?.level).toBe('action');
    expect(byId('priority')?.detail).toContain('확인하지 않은 5건');
  });

  it('처리할 일(action)이 먼저 나오고, 요약 문장에 시즌·건수가 들어간다', () => {
    const order = r.insights.map((i) => ({ action: 0, notice: 1, good: 2 })[i.level]);
    expect(order).toEqual(order.slice().sort((a, b) => a - b));
    expect(r.summary).toContain('2026 가을 시즌 신청은 60건');
    expect(r.summary).toContain('모집 구획은 78개');
    expect(r.summary).toMatch(/바로 처리할 일이 \d+건/);
  });

  it('추첨이 진행되면 인사이트가 달라진다', () => {
    const d = structuredClone(db);
    for (const g of drawGroups(d).filter((x) => x.state === 'ready')) {
      runDraw(d, g.id, 20260922, 'u_admin1');
      confirmDraw(d, g.id, 'u_admin1');
    }
    const after = buildInsights(d);
    expect(after.insights.find((i) => i.id === 'draw-result')?.title).toContain('배정률');
    expect(after.insights.find((i) => i.id === 'offers')?.title).toContain('수락을 기다리는 당첨자가 14명');
  });

  it('처리할 일이 하나도 없으면 안심 메시지', () => {
    const d = structuredClone(db);
    d.applications = [];
    d.gardens = d.gardens.filter((g) => g.status === '지정');
    d.warnings = [];
    for (const p of d.plots) p.warningCount = 0;
    d.recruitments = [];
    const calm = buildInsights(d);
    expect(calm.insights.some((i) => i.level === 'action')).toBe(false);
    expect(calm.summary).toContain('급하게 처리할 일은 없어요');
  });

  it('같은 데이터면 같은 결과', () => {
    expect(buildInsights(db)).toEqual(buildInsights(db));
  });
});

describe('공급자와 모의 답변 폴백', () => {
  const failing: AiProvider = {
    id: 'real',
    label: '실제 AI',
    isMock: false,
    recommend: async () => {
      throw new Error('API 키가 없어요');
    },
    insights: async () => {
      throw new Error('시간 초과');
    },
  };

  it('모의 공급자는 API 키 없이 답하고 모의임을 밝힌다', async () => {
    const p = createMockProvider(0);
    const res = await p.recommend(db, base);
    expect(res).toMatchObject({ isMock: true, fellBack: false, provider: '규칙 기반 모의 AI' });
    expect(res.data.gardens).toHaveLength(3);
    expect((await p.insights(db)).data.insights.length).toBeGreaterThan(0);
  });

  it('실제 공급자가 실패하면 모의 답변으로 대체하고 그 사실을 표시한다', async () => {
    const p = withFallback(failing, createMockProvider(0));
    const res = await p.recommend(db, base);
    expect(res.fellBack).toBe(true);
    expect(res.isMock).toBe(true);
    expect(res.data.gardens).toHaveLength(3);
    expect((await p.insights(db)).fellBack).toBe(true);
  });

  it('실제 공급자가 성공하면 그 답을 그대로 쓴다', async () => {
    const ok: AiProvider = { ...createMockProvider(0), id: 'real', isMock: false };
    const res = await withFallback(ok, createMockProvider(0)).recommend(db, base);
    expect(res.fellBack).toBe(false);
  });

  it('답변에 붙일 안내 문구', () => {
    expect(AI_DISCLAIMER).toContain('AI가 제공하는 참고 정보');
    expect(AI_DISCLAIMER).toContain('텃밭지원과');
  });
});
