import { describe, expect, it } from 'vitest';
import { drawGroup, prioritySeats, waitlistCapacity, type DrawApplicant, type DrawGardenInput, type DrawOutcome } from './draw';
import { mulberry32 } from './random';

const garden = (gardenId: string, plots: number, ratio = 0.3): DrawGardenInput => ({ gardenId, plots, priorityQuotaRatio: ratio });
const person = (n: number, choices: string[], isPriority = false): DrawApplicant => ({
  applicationId: `a${String(n).padStart(3, '0')}`, userId: `u${n}`, choices, isPriority,
});
const many = (from: number, count: number, choices: string[], isPriority = false) => Array.from({ length: count }, (_, i) => person(from + i, choices, isPriority));
const opts = (seed = 1, waitlistRatio = 1) => ({ seed, waitlistRatio });

const winnersOf = (o: DrawOutcome, gid: string) => o.gardens.find((g) => g.gardenId === gid)!.winners;
const gardenOf = (o: DrawOutcome, gid: string) => o.gardens.find((g) => g.gardenId === gid)!;

describe('우선 몫·대기 인원 계산', () => {
  it('우선 몫 = 구획 수 × 비율 올림 (소규모 텃밭도 0석이 되지 않는다)', () => {
    expect(prioritySeats(10, 0.3)).toBe(3); // 부동소수점 3.0000000000000004 → 3
    expect(prioritySeats(8, 0.3)).toBe(3); // 2.4 → 3
    expect(prioritySeats(6, 0.3)).toBe(2); // 1.8 → 2
    expect(prioritySeats(3, 0.3)).toBe(1); // 0.9 → 1
    expect(prioritySeats(1, 0.3)).toBe(1);
  });
  it('비율 0이면 0석, 비율이 커도 구획 수를 넘지 않는다', () => {
    expect(prioritySeats(10, 0)).toBe(0);
    expect(prioritySeats(10, 1)).toBe(10);
    expect(prioritySeats(5, 2)).toBe(5);
  });
  it('대기 인원 상한', () => {
    expect(waitlistCapacity(8, 1)).toBe(8);
    expect(waitlistCapacity(8, 0.5)).toBe(4);
    expect(waitlistCapacity(5, 0.5)).toBe(3);
    expect(waitlistCapacity(8, 0)).toBe(0);
  });
});

describe('무추첨 전원 배정 (신청자 ≤ 구획 수)', () => {
  it('신청자가 구획 수 이하이면 추첨 없이 전원 배정하고 방식이 기록된다', () => {
    const o = drawGroup([garden('g1', 5)], many(1, 3, ['g1']), opts());
    const g = gardenOf(o, 'g1');
    expect(g.method).toBe('무추첨 전원 배정');
    expect(g.winners).toHaveLength(3);
    expect(g.winners.every((w) => w.group === '전원' && w.choiceRank === 1)).toBe(true);
    expect(g.waitlist).toHaveLength(0);
    expect(g.lost).toHaveLength(0);
    expect(Object.values(o.byApplication).every((r) => r.status === '당첨')).toBe(true);
  });

  it('신청자 수가 구획 수와 같아도 전원 배정', () => {
    const o = drawGroup([garden('g1', 4)], many(1, 4, ['g1']), opts());
    expect(gardenOf(o, 'g1').method).toBe('무추첨 전원 배정');
    expect(winnersOf(o, 'g1')).toHaveLength(4);
  });

  it('구획 수보다 1명 많으면 추첨', () => {
    const o = drawGroup([garden('g1', 4)], many(1, 5, ['g1']), opts());
    expect(gardenOf(o, 'g1').method).toBe('추첨');
    expect(winnersOf(o, 'g1')).toHaveLength(4);
  });

  it('신청자가 없으면 "신청자 없음"', () => {
    const o = drawGroup([garden('g1', 4), garden('g2', 3)], many(1, 2, ['g1']), opts());
    expect(gardenOf(o, 'g2').method).toBe('신청자 없음');
    expect(gardenOf(o, 'g2').winners).toHaveLength(0);
  });
});

describe('추첨: 당첨·대기·낙첨과 대기번호', () => {
  const o = drawGroup([garden('g1', 8)], many(1, 25, ['g1']), opts(7, 1));
  const g = gardenOf(o, 'g1');

  it('당첨은 구획 수만큼, 대기는 상한(구획 수 × 1)까지, 나머지는 낙첨', () => {
    expect(g.winners).toHaveLength(8);
    expect(g.waitlist).toHaveLength(8);
    expect(g.lost).toHaveLength(25 - 8 - 8);
    expect(g.applicantCount).toBe(25);
  });

  it('대기번호는 1번부터 빈틈없이 매겨진다', () => {
    expect(g.waitlist.map((w) => w.no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('모든 신청자는 정확히 한 가지 결과를 가진다 (당첨 8 · 대기 8 · 낙첨 9)', () => {
    const rs = Object.values(o.byApplication);
    expect(rs).toHaveLength(25);
    expect(rs.filter((r) => r.status === '당첨')).toHaveLength(8);
    expect(rs.filter((r) => r.status === '대기')).toHaveLength(8);
    expect(rs.filter((r) => r.status === '낙첨')).toHaveLength(9);
    // 대기 결과의 번호가 명단과 일치
    for (const w of g.waitlist) expect(o.byApplication[w.applicationId].waitlist).toEqual([{ gardenId: 'g1', no: w.no }]);
  });

  it('대기 상한이 0이면 대기 없이 전부 낙첨', () => {
    const z = drawGroup([garden('g1', 8)], many(1, 12, ['g1']), opts(7, 0));
    expect(gardenOf(z, 'g1').waitlist).toHaveLength(0);
    expect(Object.values(z.byApplication).filter((r) => r.status === '낙첨')).toHaveLength(4);
  });

  it('대기 상한 비율 0.5 → 구획 8개면 4명', () => {
    const h = drawGroup([garden('g1', 8)], many(1, 20, ['g1']), opts(7, 0.5));
    expect(gardenOf(h, 'g1').waitlist).toHaveLength(4);
  });
});

describe('우선 배정: 별도 우선 구간, 확률 가중치는 없음', () => {
  it('우선 몫만큼(구획 10 → 3석) 우선 대상자끼리 먼저 뽑는다', () => {
    const people = [...many(1, 5, ['g1'], true), ...many(100, 25, ['g1'])];
    const o = drawGroup([garden('g1', 10)], people, opts(3));
    const w = winnersOf(o, 'g1');
    expect(w).toHaveLength(10);
    const prioSeat = w.filter((x) => x.group === '우선');
    expect(prioSeat).toHaveLength(3);
    // 우선 몫 당첨자는 모두 우선 대상자
    for (const x of prioSeat) expect(people.find((p) => p.applicationId === x.applicationId)!.isPriority).toBe(true);
    // 일반 구간 당첨자는 7명
    expect(w.filter((x) => x.group === '일반')).toHaveLength(7);
    expect(gardenOf(o, 'g1').priorityGroupCount).toBe(5);
  });

  it('우선 대상자가 우선 몫보다 적으면 남는 몫은 일반 그룹으로 넘어간다', () => {
    const people = [...many(1, 1, ['g1'], true), ...many(100, 20, ['g1'])]; // 우선 1명, 몫 3석
    const o = drawGroup([garden('g1', 10)], people, opts(11));
    const w = winnersOf(o, 'g1');
    expect(w).toHaveLength(10);
    expect(w.filter((x) => x.group === '우선')).toHaveLength(1); // 우선 대상자는 몫 안에서 당첨
    expect(w.filter((x) => x.group === '일반')).toHaveLength(9); // 남는 2석이 일반으로 넘어감
    expect(w.find((x) => x.applicationId === 'a001')?.group).toBe('우선');
  });

  it('우선 몫에서 떨어진 우선 대상자도 일반 추첨에 다시 참여한다 (일반 신청자보다 불리하지 않다)', () => {
    // 우선 대상 10명, 일반 2명, 구획 8(우선 몫 3석) → 일반 구간 5석에 일반 2 + 우선 탈락 7 = 9명이 경쟁
    let prioWonGeneral = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const people = [...many(1, 10, ['g1'], true), ...many(100, 2, ['g1'])];
      const w = winnersOf(drawGroup([garden('g1', 8)], people, opts(seed)), 'g1');
      expect(w.filter((x) => x.group === '우선')).toHaveLength(3);
      prioWonGeneral += w.filter((x) => x.group === '일반' && people.find((p) => p.applicationId === x.applicationId)!.isPriority).length;
    }
    expect(prioWonGeneral).toBeGreaterThan(0);
  });

  it('우선 몫이 0석(비율 0)이면 우선 대상자도 일반 신청자와 완전히 같은 확률이다 (가중치 없음)', () => {
    // 2석에 10명(우선 2, 일반 8): 모두 기대 당첨률 20%
    let prioWins = 0;
    let generalWins = 0;
    const N = 6000;
    for (let seed = 1; seed <= N; seed++) {
      const people = [...many(1, 2, ['g1'], true), ...many(100, 8, ['g1'])];
      for (const w of winnersOf(drawGroup([garden('g1', 2, 0)], people, opts(seed)), 'g1')) {
        if (w.applicationId < 'a100') prioWins++;
        else generalWins++;
      }
    }
    const prioRate = prioWins / (2 * N);
    const generalRate = generalWins / (8 * N);
    expect(prioRate).toBeGreaterThan(0.18);
    expect(prioRate).toBeLessThan(0.22);
    expect(generalRate).toBeGreaterThan(0.18);
    expect(generalRate).toBeLessThan(0.22);
  });

  it('같은 그룹 안에서는 동일 확률 (우선 몫 1석을 우선 대상자 4명이 나눠 갖는다)', () => {
    const wins = [0, 0, 0, 0];
    const N = 4000;
    for (let seed = 1; seed <= N; seed++) {
      const people = [...many(1, 4, ['g1'], true), ...many(100, 6, ['g1'])];
      for (const w of winnersOf(drawGroup([garden('g1', 3, 0.3)], people, opts(seed)), 'g1')) {
        if (w.group === '우선') wins[Number(w.applicationId.slice(1)) - 1]++;
      }
    }
    for (const c of wins) {
      expect(c / N).toBeGreaterThan(0.22); // 기대값 25%
      expect(c / N).toBeLessThan(0.28);
    }
  });

  it('우선 몫은 비율 설정을 따른다 (50%면 10석 중 5석)', () => {
    const people = [...many(1, 12, ['g1'], true), ...many(100, 12, ['g1'])];
    const w = winnersOf(drawGroup([garden('g1', 10, 0.5)], people, opts(2)), 'g1');
    expect(w.filter((x) => x.group === '우선')).toHaveLength(5);
  });
});

describe('지망 순위', () => {
  it('1지망에 당첨되면 2·3지망 추첨에서 빠진다', () => {
    const people = [person(1, ['g1', 'g2']), person(2, ['g2'])];
    const o = drawGroup([garden('g1', 1), garden('g2', 1)], people, opts(1));
    expect(winnersOf(o, 'g1').map((w) => w.applicationId)).toEqual(['a001']);
    // a001은 이미 당첨이라 g2에는 들어오지 않는다
    expect(gardenOf(o, 'g2').applicantCount).toBe(1);
    expect(winnersOf(o, 'g2').map((w) => w.applicationId)).toEqual(['a002']);
  });

  it('1지망에서 떨어진 사람은 2지망 텃밭 추첨에 들어가 당첨될 수 있다 (choiceRank 2)', () => {
    // g1은 1석에 2명(a1·a2) → 한 명은 탈락해 g2(2지망, 1석)로 간다. a3는 g2 1지망이지만 g2 라운드1에서 먼저 처리된다.
    const people = [person(1, ['g1', 'g2']), person(2, ['g1', 'g2']), person(3, ['g2'])];
    for (let seed = 1; seed <= 20; seed++) {
      const o = drawGroup([garden('g1', 1), garden('g2', 2)], people, opts(seed));
      // g2: 라운드1 a3 → 1석 사용, 라운드2 g1 탈락자 → 남은 1석 → 전원 배정. 세 명 모두 당첨
      expect(Object.values(o.byApplication).every((r) => r.status === '당첨')).toBe(true);
      const second = winnersOf(o, 'g2').find((w) => w.choiceRank === 2);
      expect(second).toBeTruthy();
      expect(['a001', 'a002']).toContain(second!.applicationId);
    }
  });

  it('1지망은 2지망보다 항상 먼저 처리된다: 2지망 지원자는 1지망 지원자가 다 차지한 자리를 못 얻는다', () => {
    // g1 1석: a1은 g1 1지망, a2는 g0 1지망이었다가 떨어지고 g1 2지망 → g1은 a1이 차지
    const people = [person(1, ['g1']), person(2, ['g0', 'g1']), person(3, ['g0'])];
    for (let seed = 1; seed <= 20; seed++) {
      const o = drawGroup([garden('g0', 1), garden('g1', 1)], people, opts(seed));
      expect(winnersOf(o, 'g1').map((w) => w.applicationId)).toEqual(['a001']);
    }
  });

  it('3지망까지 내려가며 당첨자는 각 지망 순위를 기록한다', () => {
    const people = [person(1, ['g1', 'g2', 'g3']), person(2, ['g1', 'g2', 'g3']), person(3, ['g1', 'g2', 'g3']), person(4, ['g1', 'g2', 'g3'])];
    const o = drawGroup([garden('g1', 1), garden('g2', 1), garden('g3', 1)], people, opts(5));
    expect(winnersOf(o, 'g1')[0].choiceRank).toBe(1);
    expect(winnersOf(o, 'g2')[0].choiceRank).toBe(2);
    expect(winnersOf(o, 'g3')[0].choiceRank).toBe(3);
    expect(Object.values(o.byApplication).filter((r) => r.status === '당첨')).toHaveLength(3);
    // 한 명은 끝까지 배정받지 못하고 세 텃밭 모두에서 대기
    const loser = Object.entries(o.byApplication).find(([, r]) => r.status !== '당첨')![1];
    expect(loser.status).toBe('대기');
    expect(loser.waitlist.map((w) => w.gardenId)).toEqual(['g1', 'g2', 'g3']);
  });

  it('여러 텃밭에서 대기 중인 사람의 대기 목록은 지망 순서로 정렬된다', () => {
    const people = [...many(1, 3, ['g2', 'g1'])];
    const o = drawGroup([garden('g1', 1), garden('g2', 1)], people, opts(4));
    const waiting = Object.values(o.byApplication).find((r) => r.status === '대기')!;
    expect(waiting.waitlist[0].gardenId).toBe('g2');
  });

  it('우선 몫도 지망 라운드마다 남은 자리 안에서만 쓴다', () => {
    // g1 10석 우선 3석. 1지망 라운드에서 우선 대상 3명이 전원 배정(무추첨)으로 3석을 쓰면 2지망 라운드의 우선 몫은 0석
    const first = [...many(1, 3, ['g1'], true)];
    const second = [...many(50, 3, ['g0', 'g1'], true), ...many(100, 20, ['g0', 'g1'])];
    const o = drawGroup([garden('g0', 1), garden('g1', 10)], [...first, ...second], opts(9));
    expect(winnersOf(o, 'g1').filter((w) => w.choiceRank === 2 && w.group === '우선')).toHaveLength(0);
  });
});

describe('재현성', () => {
  const people = [...many(1, 6, ['g1', 'g2'], true), ...many(100, 30, ['g1', 'g2']), ...many(200, 10, ['g2'])];
  const gardens = [garden('g1', 8), garden('g2', 6)];

  it('같은 시드·같은 신청이면 결과가 완전히 같다', () => {
    expect(drawGroup(gardens, people, opts(42))).toEqual(drawGroup(gardens, people, opts(42)));
  });
  it('신청 목록·텃밭 목록의 순서가 달라도 결과는 같다', () => {
    const shuffled = people.slice().reverse();
    expect(drawGroup(gardens.slice().reverse(), shuffled, opts(42))).toEqual(drawGroup(gardens, people, opts(42)));
  });
  it('시드가 다르면 결과가 달라질 수 있다', () => {
    const ids = (o: DrawOutcome) => winnersOf(o, 'g1').map((w) => w.applicationId).join();
    const all = new Set(Array.from({ length: 10 }, (_, s) => ids(drawGroup(gardens, people, opts(s + 1)))));
    expect(all.size).toBeGreaterThan(1);
  });
  it('결과에 시드값이 담긴다', () => {
    expect(drawGroup(gardens, people, opts(20260922)).seed).toBe(20260922);
  });
});

describe('불변식 (무작위 시나리오 300건)', () => {
  it('당첨은 구획을 넘지 않고, 한 사람은 한 곳에만 당첨되며, 결과가 서로 모순되지 않는다', () => {
    const rng = mulberry32(2026);
    for (let t = 0; t < 300; t++) {
      const nG = 1 + Math.floor(rng() * 4);
      const gs = Array.from({ length: nG }, (_, i) => garden(`g${i + 1}`, 1 + Math.floor(rng() * 8), [0, 0.3, 0.5][Math.floor(rng() * 3)]));
      const nP = Math.floor(rng() * 40);
      const people = Array.from({ length: nP }, (_, i) => {
        const pool = gs.map((g) => g.gardenId).sort(() => rng() - 0.5);
        return person(i + 1, pool.slice(0, 1 + Math.floor(rng() * Math.min(3, nG))), rng() < 0.25);
      });
      const ratio = [0, 0.5, 1][Math.floor(rng() * 3)];
      const o = drawGroup(gs, people, { seed: t + 1, waitlistRatio: ratio });

      const winnerIds = o.gardens.flatMap((g) => g.winners.map((w) => w.applicationId));
      expect(new Set(winnerIds).size).toBe(winnerIds.length); // 중복 당첨 없음
      for (const g of o.gardens) {
        const input = gs.find((x) => x.gardenId === g.gardenId)!;
        expect(g.winners.length).toBeLessThanOrEqual(input.plots);
        expect(g.winners.filter((w) => w.group === '우선').length).toBeLessThanOrEqual(prioritySeats(input.plots, input.priorityQuotaRatio));
        expect(g.waitlist.map((w) => w.no)).toEqual(g.waitlist.map((_, i) => i + 1));
        expect(g.waitlist.length).toBeLessThanOrEqual(waitlistCapacity(input.plots, ratio));
        // 자리가 남았다면 그 텃밭을 지망한 미배정자는 없어야 한다
        if (g.winners.length < input.plots) {
          const stillWaiting = people.filter((p) => p.choices.includes(g.gardenId) && o.byApplication[p.applicationId].status !== '당첨');
          expect(stillWaiting).toHaveLength(0);
        }
        for (const w of g.winners) expect(people.find((p) => p.applicationId === w.applicationId)!.choices[w.choiceRank - 1]).toBe(g.gardenId);
      }
      for (const p of people) {
        const r = o.byApplication[p.applicationId];
        expect(['당첨', '대기', '낙첨']).toContain(r.status);
        if (r.status === '당첨') expect(r.waitlist).toHaveLength(0);
        if (r.status === '대기') expect(r.waitlist.length).toBeGreaterThan(0);
        if (r.status === '낙첨') expect(r.waitlist).toHaveLength(0);
        for (const w of r.waitlist) expect(p.choices).toContain(w.gardenId);
      }
    }
  });
});
