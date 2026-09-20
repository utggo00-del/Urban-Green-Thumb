import { describe, expect, it } from 'vitest';
import { buildSeed } from '../data/seed';
import { designationLabel, meetingLabel, nextRound } from './meeting';

describe('회차는 연도별로 센다', () => {
  const meetings = [
    { year: 2025, kind: '정례' as const, round: 1 },
    { year: 2026, kind: '정례' as const, round: 1 },
    { year: 2026, kind: '정례' as const, round: 2 },
  ];

  it('새 해의 첫 회의는 제1회', () => {
    expect(nextRound(meetings, 2027, '정례')).toBe(1);
  });
  it('같은 해·같은 종류 안에서만 이어서 센다', () => {
    expect(nextRound(meetings, 2026, '정례')).toBe(3);
    expect(nextRound(meetings, 2025, '정례')).toBe(2);
  });
  it('임시회의는 정례회의와 따로 센다', () => {
    expect(nextRound(meetings, 2026, '임시')).toBe(1);
    expect(nextRound([...meetings, { year: 2026, kind: '임시', round: 1 }], 2026, '임시')).toBe(2);
  });
  it('표시 문구', () => {
    expect(meetingLabel({ year: 2026, round: 1, kind: '정례', half: '상반기' })).toBe('2026년 제1회 정례회의(상반기)');
    expect(meetingLabel({ year: 2026, round: 1, kind: '임시', half: null })).toBe('2026년 제1회 임시회의');
    expect(designationLabel({ agendaId: null, meetingId: null, meetingKind: '정례', round: 1, decidedAt: '2026-01-22' })).toBe(
      '2026년 제1회 정례회의, 2026.01.22',
    );
  });

  it('시드 회의: 연도·종류별로 1부터 빠짐없이 부여되어 있고 지정 텃밭의 회차와 일치한다', () => {
    const db = buildSeed();
    const groups = new Map<string, number[]>();
    for (const m of [...db.meetings].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))) {
      const key = `${m.year}-${m.kind}`;
      groups.set(key, [...(groups.get(key) ?? []), m.round]);
    }
    for (const rounds of groups.values()) expect(rounds).toEqual(rounds.map((_, i) => i + 1));
    expect(db.meetings.find((m) => m.id === 'mt_2')?.round).toBe(1); // 2026년 상반기 = 제1회
    expect(db.meetings.find((m) => m.id === 'mt_3')?.round).toBe(2); // 2026년 하반기 = 제2회

    for (const g of db.gardens.filter((x) => x.designation)) {
      const d = g.designation!;
      if (d.meetingId) {
        const m = db.meetings.find((x) => x.id === d.meetingId)!;
        expect(d.round).toBe(m.round);
        expect(d.decidedAt.slice(0, 4)).toBe(String(m.year));
        expect(d.meetingKind).toBe(m.kind);
      }
    }
  });
});
