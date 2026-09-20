// 텃밭 추첨 (SPEC 5.2). 순수 함수 — 같은 입력과 같은 시드는 항상 같은 결과를 만든다.
//
// 정책: 우선 배정 대상자에게 "확률 가중치"는 없다. 대신 우선 몫(전체 구획의 일정 비율)을 따로 먼저 추첨한다.
//
//  1. 지망 순위대로 라운드를 돈다. 1지망 텃밭들을 추첨하고, 떨어진 사람은 2지망, 그다음 3지망으로 넘어간다.
//     이미 당첨된 사람은 이후 지망에서 빠진다.
//  2. 한 텃밭·한 라운드의 지원자가 남은 구획 이하이면 추첨 없이 전원 배정한다. (무추첨 전원 배정)
//  3. 그보다 많으면 추첨한다: 우선 배정 대상자끼리 우선 몫만큼 먼저 뽑고(동일 확률),
//     남은 구획은 나머지 전원(우선 몫에서 떨어진 사람 포함)이 동일 확률로 뽑는다.
//     우선 대상자가 우선 몫보다 적으면 남는 몫은 자연스럽게 일반 추첨으로 넘어간다.
//  4. 끝까지 배정받지 못한 사람은 지망한 텃밭마다 무작위 순서로 대기번호를 받고, 대기 인원 상한을 넘으면 낙첨이다.
//
// 우선 몫에서 떨어진 사람이 일반 추첨에 다시 들어가는 이유: 그렇지 않으면 우선 대상자가 많은 텃밭에서
// 오히려 일반 신청자보다 당첨 확률이 낮아지는 역전이 생긴다. (정책상 가정 — 운영지침으로 확정 필요)
import { mulberry32, shuffle, type Rng } from './random';

export interface DrawGardenInput {
  gardenId: string;
  /** 이번에 모집하는 구획 수 */
  plots: number;
  /** 우선 배정 몫 비율 (0~1). 구획 수 × 비율을 올림한다. */
  priorityQuotaRatio: number;
}

export interface DrawApplicant {
  applicationId: string;
  userId: string;
  /** 지망 순서대로 텃밭 id */
  choices: string[];
  /** 우선 몫 추첨에 들어갈 수 있는지 (자기신고 + 관리자 확인 여부는 호출하는 쪽에서 정한다) */
  isPriority: boolean;
}

export interface DrawOptions {
  seed: number;
  /** 대기 인원 상한 = 모집 구획 수 × 비율(올림). 0이면 대기 없이 낙첨 */
  waitlistRatio: number;
}

export type DrawMethod = '추첨' | '무추첨 전원 배정' | '신청자 없음';
export type WinGroup = '우선' | '일반' | '전원';

export interface Winner {
  applicationId: string;
  userId: string;
  choiceRank: number;
  group: WinGroup;
}

export interface GardenOutcome {
  gardenId: string;
  plots: number;
  method: DrawMethod;
  /** 이 텃밭 추첨에 실제로 들어간 신청자 수 (라운드마다 남아 있던 지원자의 합집합) */
  applicantCount: number;
  /** 그중 우선 몫 추첨 대상자 수 */
  priorityGroupCount: number;
  winners: Winner[];
  waitlist: { applicationId: string; userId: string; no: number; choiceRank: number }[];
  /** 이 텃밭 추첨에서 떨어졌고 이 텃밭 대기 명단에도 없는 사람 */
  lost: { applicationId: string; userId: string; choiceRank: number }[];
}

export interface ApplicationOutcome {
  status: '당첨' | '대기' | '낙첨';
  /** 당첨된 텃밭 */
  gardenId?: string;
  choiceRank?: number;
  group?: WinGroup;
  /** 대기 중인 텃밭·번호 (지망 순서) */
  waitlist: { gardenId: string; no: number }[];
}

export interface DrawOutcome {
  seed: number;
  gardens: GardenOutcome[];
  byApplication: Record<string, ApplicationOutcome>;
}

/** 우선 몫 좌석 수: 구획 수 × 비율, 올림. (소규모 텃밭에서도 우선 몫이 0석이 되지 않게 한다) */
export const prioritySeats = (plots: number, ratio: number): number => Math.min(plots, Math.max(0, Math.ceil(plots * ratio - 1e-9)));

/** 대기 인원 상한 */
export const waitlistCapacity = (plots: number, ratio: number): number => Math.max(0, Math.ceil(plots * ratio - 1e-9));

export function drawGroup(gardens: readonly DrawGardenInput[], applicants: readonly DrawApplicant[], options: DrawOptions): DrawOutcome {
  const rng: Rng = mulberry32(options.seed);
  const sortedGardens = gardens.slice().sort((a, b) => a.gardenId.localeCompare(b.gardenId));
  // 입력 순서가 결과에 영향을 주지 않도록 신청 id 순으로 고정한다 (재현성)
  const people = applicants.slice().sort((a, b) => a.applicationId.localeCompare(b.applicationId));
  const rounds = people.reduce((m, p) => Math.max(m, p.choices.length), 0);

  const seatsLeft = new Map(sortedGardens.map((g) => [g.gardenId, g.plots]));
  const prioLeft = new Map(sortedGardens.map((g) => [g.gardenId, prioritySeats(g.plots, g.priorityQuotaRatio)]));
  const won = new Map<string, Winner & { gardenId: string }>();
  const outcome = new Map<string, GardenOutcome>(
    sortedGardens.map((g) => [
      g.gardenId,
      { gardenId: g.gardenId, plots: g.plots, method: '신청자 없음', applicantCount: 0, priorityGroupCount: 0, winners: [], waitlist: [], lost: [] },
    ]),
  );
  const entered = new Map<string, Map<string, number>>(sortedGardens.map((g) => [g.gardenId, new Map()])); // 텃밭별: 신청id → 처음 들어간 지망 순위
  let lotteryHeld = new Set<string>();

  for (let rank = 1; rank <= rounds; rank++) {
    for (const g of sortedGardens) {
      const cands = people.filter((p) => !won.has(p.applicationId) && p.choices[rank - 1] === g.gardenId);
      if (cands.length === 0) continue;
      const o = outcome.get(g.gardenId)!;
      for (const c of cands) if (!entered.get(g.gardenId)!.has(c.applicationId)) entered.get(g.gardenId)!.set(c.applicationId, rank);

      const seats = seatsLeft.get(g.gardenId)!;
      if (seats <= 0) continue;

      const win = (p: DrawApplicant, group: WinGroup) => {
        const w = { applicationId: p.applicationId, userId: p.userId, choiceRank: rank, group };
        won.set(p.applicationId, { ...w, gardenId: g.gardenId });
        o.winners.push(w);
      };

      if (cands.length <= seats) {
        cands.forEach((p) => win(p, '전원'));
        seatsLeft.set(g.gardenId, seats - cands.length);
        // 우선 몫도 함께 소진한 것으로 본다
        prioLeft.set(g.gardenId, Math.max(0, prioLeft.get(g.gardenId)! - cands.filter((p) => p.isPriority).length));
        continue;
      }

      // 경쟁이 있는 라운드 — 우선 몫을 먼저, 그다음 일반 추첨
      lotteryHeld = lotteryHeld.add(g.gardenId);
      const quota = Math.min(prioLeft.get(g.gardenId)!, seats);
      const prio = cands.filter((p) => p.isPriority);
      const prioWinners = quota > 0 ? shuffle(prio, rng).slice(0, quota) : [];
      prioWinners.forEach((p) => win(p, '우선'));
      prioLeft.set(g.gardenId, prioLeft.get(g.gardenId)! - prioWinners.length);

      const generalSeats = seats - prioWinners.length;
      const pool = cands.filter((p) => !prioWinners.includes(p));
      shuffle(pool, rng)
        .slice(0, generalSeats)
        .forEach((p) => win(p, '일반'));
      seatsLeft.set(g.gardenId, 0);
    }
  }

  // 방식·신청자 수 정리
  for (const g of sortedGardens) {
    const o = outcome.get(g.gardenId)!;
    const ids = [...entered.get(g.gardenId)!.keys()];
    o.applicantCount = ids.length;
    o.priorityGroupCount = people.filter((p) => ids.includes(p.applicationId) && p.isPriority).length;
    o.method = ids.length === 0 ? '신청자 없음' : lotteryHeld.has(g.gardenId) ? '추첨' : '무추첨 전원 배정';
  }

  // 대기번호: 끝까지 배정받지 못한 사람을 지망한 텃밭마다 무작위 순서로 줄 세우고, 상한을 넘으면 낙첨
  const byApplication: Record<string, ApplicationOutcome> = {};
  for (const p of people) {
    const w = won.get(p.applicationId);
    byApplication[p.applicationId] = w
      ? { status: '당첨', gardenId: w.gardenId, choiceRank: w.choiceRank, group: w.group, waitlist: [] }
      : { status: '낙첨', waitlist: [] };
  }
  for (const g of sortedGardens) {
    const o = outcome.get(g.gardenId)!;
    const cap = waitlistCapacity(g.plots, options.waitlistRatio);
    const waiting = shuffle(
      people.filter((p) => !won.has(p.applicationId) && entered.get(g.gardenId)!.has(p.applicationId)),
      rng,
    );
    waiting.forEach((p, i) => {
      const choiceRank = p.choices.indexOf(g.gardenId) + 1;
      if (i < cap) {
        o.waitlist.push({ applicationId: p.applicationId, userId: p.userId, no: i + 1, choiceRank });
        byApplication[p.applicationId].waitlist.push({ gardenId: g.gardenId, no: i + 1 });
      } else {
        o.lost.push({ applicationId: p.applicationId, userId: p.userId, choiceRank });
      }
    });
  }
  // 지망 순서대로 정렬하고, 대기 명단에 한 곳이라도 있으면 "대기", 없으면 "낙첨"
  for (const p of people) {
    const r = byApplication[p.applicationId];
    r.waitlist.sort((a, b) => p.choices.indexOf(a.gardenId) - p.choices.indexOf(b.gardenId));
    if (r.status !== '당첨' && r.waitlist.length > 0) r.status = '대기';
  }
  // 다른 텃밭에서 이긴 사람이 앞선 지망에서 "떨어진" 기록도 lost에 남겨 감사 로그에서 보이게 한다
  for (const g of sortedGardens) {
    const o = outcome.get(g.gardenId)!;
    for (const [appId, rank] of entered.get(g.gardenId)!) {
      const winnerHere = o.winners.some((w) => w.applicationId === appId);
      const listed = o.waitlist.some((w) => w.applicationId === appId) || o.lost.some((l) => l.applicationId === appId);
      if (!winnerHere && !listed) o.lost.push({ applicationId: appId, userId: people.find((p) => p.applicationId === appId)!.userId, choiceRank: rank });
    }
  }

  return { seed: options.seed, gardens: sortedGardens.map((g) => outcome.get(g.gardenId)!), byApplication };
}
