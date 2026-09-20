// 도시농업위원회 회의·의결 판정 (조례 제8조). 순수 함수 — 기준 비율은 config의 COMMITTEE_RULES 상수.
//
//  · 개회 요건: 출석위원이 재적위원의 과반   (출석 > 재적 × 1/2)
//  · 가결 요건: 개회 요건을 갖춘 상태에서 찬성이 출석위원의 과반   (찬성 > 출석 × 1/2)
//    → 기권·미투표도 출석위원 수에는 포함되므로 “출석 과반 찬성”이다. (투표자 과반이 아님)
import { COMMITTEE_RULES } from '../config';
import type { CommitteeMember, VoteChoice, Vote } from '../types';

/** 개회에 필요한 최소 출석 인원. 재적 12명 → 7명, 재적 11명 → 6명 */
export const minAttendeesForQuorum = (total: number): number => Math.floor(total * COMMITTEE_RULES.quorumRatio) + 1;

/** 개회 요건: 재적위원 과반 출석 */
export const isQuorumMet = (total: number, attendees: number): boolean => total > 0 && attendees > total * COMMITTEE_RULES.quorumRatio;

/** 가결에 필요한 최소 찬성 인원. 출석 7명 → 4명, 출석 8명 → 5명 */
export const minYesToPass = (attendees: number): number => Math.floor(attendees * COMMITTEE_RULES.passRatio) + 1;

/** 출석위원 과반 찬성 여부 (개회 요건은 따로 본다) */
export const isMajorityYes = (attendees: number, yes: number): boolean => attendees > 0 && yes > attendees * COMMITTEE_RULES.passRatio;

export interface Counts {
  total: number;
  attendees: number;
  yes: number;
  no: number;
  abstain: number;
}

/** 입력 인원의 앞뒤가 맞는지 확인. 문제가 있으면 안내 문구를 돌려준다. */
export function validateCounts({ total, attendees, yes, no, abstain }: Counts): string | null {
  const all = [total, attendees, yes, no, abstain];
  if (all.some((n) => !Number.isInteger(n) || n < 0)) return '인원은 0 이상의 정수로 입력해 주세요.';
  if (attendees > total) return '출석위원 수가 재적위원 수보다 많을 수 없습니다.';
  if (yes + no + abstain > attendees) return '찬성·반대·보류의 합이 출석위원 수보다 많을 수 없습니다.';
  return null;
}

export type Judgement =
  | { canDecide: false; quorumMet: false; passed: false; suggested: null; reason: string }
  | { canDecide: true; quorumMet: true; passed: boolean; suggested: '가결' | '부결'; reason: string };

/**
 * 안건 하나를 의결할 수 있는지, 가결인지 판정한다.
 * 개회 요건 미달이면 의결 자체를 막는다. (SPEC 5.7)
 */
export function judgeAgenda(c: Counts): Judgement {
  if (!isQuorumMet(c.total, c.attendees)) {
    return {
      canDecide: false,
      quorumMet: false,
      passed: false,
      suggested: null,
      reason: `개회 요건 미달 — 출석 ${c.attendees}명 / 재적 ${c.total}명 (재적 과반인 ${minAttendeesForQuorum(c.total)}명 이상 출석해야 의결할 수 있어요)`,
    };
  }
  const passed = isMajorityYes(c.attendees, c.yes);
  return {
    canDecide: true,
    quorumMet: true,
    passed,
    suggested: passed ? '가결' : '부결',
    reason: passed
      ? `가결 요건 충족 — 찬성 ${c.yes}명 / 출석 ${c.attendees}명 (출석 과반인 ${minYesToPass(c.attendees)}명 이상)`
      : `가결 요건 미달 — 찬성 ${c.yes}명 / 출석 ${c.attendees}명 (출석 과반인 ${minYesToPass(c.attendees)}명 이상 찬성해야 해요)`,
  };
}

export interface Tally {
  yes: number;
  no: number;
  /** 보류 의견 */
  abstain: number;
  voted: number;
  /** 출석했지만 아직 투표하지 않은 위원 수 */
  notVoted: number;
}

/** 안건의 투표 집계. 출석한 위원의 표만 센다. */
export function tallyVotes(votes: readonly Vote[], agendaId: string, attendeeIds: readonly string[]): Tally {
  const present = new Set(attendeeIds);
  const mine = votes.filter((v) => v.agendaId === agendaId && present.has(v.memberId));
  const count = (c: VoteChoice) => mine.filter((v) => v.choice === c).length;
  return { yes: count('찬성'), no: count('반대'), abstain: count('보류'), voted: mine.length, notVoted: present.size - mine.length };
}

/** 위원장이 없으면 부위원장이 직무를 대행한다 (조례 제6조, 표시용). */
export function presiding(members: readonly CommitteeMember[], attendeeIds: readonly string[]): { member: CommitteeMember; acting: boolean } | null {
  const here = members.filter((m) => attendeeIds.includes(m.id));
  const chair = here.find((m) => m.position === '위원장');
  if (chair) return { member: chair, acting: false };
  const vice = here.find((m) => m.position === '부위원장');
  return vice ? { member: vice, acting: true } : null;
}
