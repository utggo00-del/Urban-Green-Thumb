import { describe, expect, it } from 'vitest';
import { buildSeed } from '../data/seed';
import type { Vote } from '../types';
import { isMajorityYes, isQuorumMet, judgeAgenda, minAttendeesForQuorum, minYesToPass, presiding, tallyVotes, validateCounts } from './committee';

const counts = (total: number, attendees: number, yes: number, no = 0, abstain = 0) => ({ total, attendees, yes, no, abstain });

describe('개회 요건: 재적위원 과반 출석 (출석 > 재적/2)', () => {
  it('재적 12명(짝수): 6명은 딱 절반이라 미달, 7명부터 충족', () => {
    expect(isQuorumMet(12, 5)).toBe(false);
    expect(isQuorumMet(12, 6)).toBe(false);
    expect(isQuorumMet(12, 7)).toBe(true);
    expect(minAttendeesForQuorum(12)).toBe(7);
  });

  it('재적 11명(홀수): 5명 미달, 6명부터 충족', () => {
    expect(isQuorumMet(11, 5)).toBe(false);
    expect(isQuorumMet(11, 6)).toBe(true);
    expect(minAttendeesForQuorum(11)).toBe(6);
  });

  it('재적 15명(상한): 8명부터 충족. 재적 0명·출석 0명은 성립하지 않는다', () => {
    expect(isQuorumMet(15, 7)).toBe(false);
    expect(isQuorumMet(15, 8)).toBe(true);
    expect(isQuorumMet(0, 0)).toBe(false);
    expect(isQuorumMet(12, 0)).toBe(false);
  });

  it('전원 출석은 항상 충족', () => {
    for (const total of [1, 2, 3, 10, 11, 12, 15]) expect(isQuorumMet(total, total)).toBe(true);
  });
});

describe('가결 요건: 출석위원 과반 찬성 (찬성 > 출석/2)', () => {
  it('출석 8명(짝수): 찬성 4명은 딱 절반이라 부결, 5명부터 가결', () => {
    expect(isMajorityYes(8, 4)).toBe(false);
    expect(isMajorityYes(8, 5)).toBe(true);
    expect(minYesToPass(8)).toBe(5);
  });

  it('출석 7명(홀수): 찬성 3명 부결, 4명부터 가결', () => {
    expect(isMajorityYes(7, 3)).toBe(false);
    expect(isMajorityYes(7, 4)).toBe(true);
    expect(minYesToPass(7)).toBe(4);
  });

  it('출석 12명: 6명 찬성은 부결, 7명부터 가결', () => {
    expect(isMajorityYes(12, 6)).toBe(false);
    expect(isMajorityYes(12, 7)).toBe(true);
  });

  it('출석 1명이 전부 찬성이면 가결, 출석 0명은 성립하지 않는다', () => {
    expect(isMajorityYes(1, 1)).toBe(true);
    expect(isMajorityYes(0, 0)).toBe(false);
  });
});

describe('judgeAgenda', () => {
  it('개회 요건 미달이면 찬성이 전원이어도 의결할 수 없다', () => {
    const j = judgeAgenda(counts(12, 6, 6));
    expect(j.canDecide).toBe(false);
    expect(j.suggested).toBeNull();
    expect(j.reason).toContain('개회 요건 미달');
    expect(j.reason).toContain('7명');
  });

  it('개회 요건을 갖추고 출석 과반이 찬성하면 가결', () => {
    const j = judgeAgenda(counts(12, 7, 4, 3));
    expect(j).toMatchObject({ canDecide: true, passed: true, suggested: '가결' });
  });

  it('경계: 출석 7명에 찬성 3명이면 부결 (기권·미투표도 출석에 포함)', () => {
    const j = judgeAgenda(counts(12, 7, 3, 0, 0));
    expect(j).toMatchObject({ canDecide: true, passed: false, suggested: '부결' });
    expect(j.reason).toContain('4명 이상');
  });

  it('찬성이 투표자 과반이어도 출석 과반이 아니면 부결 (찬성 3, 반대 0, 보류 0 / 출석 8)', () => {
    expect(judgeAgenda(counts(12, 8, 3)).suggested).toBe('부결');
    expect(judgeAgenda(counts(12, 8, 4)).suggested).toBe('부결');
    expect(judgeAgenda(counts(12, 8, 5)).suggested).toBe('가결');
  });

  it('개회 요건 경계: 재적 12명 출석 6명 → 불가 / 7명 → 가능', () => {
    expect(judgeAgenda(counts(12, 6, 6)).canDecide).toBe(false);
    expect(judgeAgenda(counts(12, 7, 7)).canDecide).toBe(true);
  });

  it('재적 홀수(11명) 경계: 출석 5명 불가, 6명이면 찬성 4명부터 가결', () => {
    expect(judgeAgenda(counts(11, 5, 5)).canDecide).toBe(false);
    expect(judgeAgenda(counts(11, 6, 3)).suggested).toBe('부결');
    expect(judgeAgenda(counts(11, 6, 4)).suggested).toBe('가결');
  });
});

describe('validateCounts', () => {
  it('정상 입력은 통과', () => {
    expect(validateCounts(counts(12, 10, 6, 3, 1))).toBeNull();
    expect(validateCounts(counts(12, 10, 0))).toBeNull(); // 미투표는 허용
  });
  it('출석이 재적보다 많거나, 표의 합이 출석보다 많거나, 음수·소수면 오류', () => {
    expect(validateCounts(counts(12, 13, 0))).toContain('재적');
    expect(validateCounts(counts(12, 5, 4, 2))).toContain('합');
    expect(validateCounts(counts(12, 5, -1))).toContain('정수');
    expect(validateCounts(counts(12, 5, 1.5))).toContain('정수');
  });
});

describe('tallyVotes', () => {
  const v = (memberId: string, choice: Vote['choice'], agendaId = 'a1'): Vote => ({ id: `${agendaId}_${memberId}`, agendaId, memberId, choice, comment: '', votedAt: '2026-09-20T14:00' });
  const votes = [v('m1', '찬성'), v('m2', '찬성'), v('m3', '반대'), v('m4', '보류'), v('m5', '찬성'), v('m1', '찬성', 'a2')];

  it('출석한 위원의 표만 센다 (결석자의 표·다른 안건의 표는 제외)', () => {
    const t = tallyVotes(votes, 'a1', ['m1', 'm2', 'm3', 'm4', 'm6']);
    expect(t).toEqual({ yes: 2, no: 1, abstain: 1, voted: 4, notVoted: 1 });
  });
  it('투표가 없으면 전원 미투표', () => {
    expect(tallyVotes([], 'a1', ['m1', 'm2'])).toEqual({ yes: 0, no: 0, abstain: 0, voted: 0, notVoted: 2 });
  });
});

describe('직무 대행 (조례 제6조)', () => {
  const { members } = buildSeed();
  const chair = members.find((m) => m.position === '위원장')!;
  const vice = members.find((m) => m.position === '부위원장')!;
  const other = members.find((m) => m.position === '위원')!;

  it('위원장이 출석하면 위원장이 주재', () => {
    expect(presiding(members, [chair.id, vice.id])).toEqual({ member: chair, acting: false });
  });
  it('위원장이 없으면 부위원장이 직무 대행', () => {
    expect(presiding(members, [vice.id, other.id])).toEqual({ member: vice, acting: true });
  });
  it('둘 다 없으면 주재자 없음', () => {
    expect(presiding(members, [other.id])).toBeNull();
  });
});
