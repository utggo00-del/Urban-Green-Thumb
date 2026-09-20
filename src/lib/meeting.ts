import type { Designation, Meeting, MeetingKind } from '../types';
import { formatDate } from './date';

/**
 * 회차는 연도별·회의 종류별로 센다. (정례회의와 임시회의는 각각 매년 제1회부터)
 * 회의를 등록할 때 다음 회차를 자동으로 부여하는 데 쓴다. (SPEC 5.7)
 */
export function nextRound(meetings: readonly Pick<Meeting, 'year' | 'kind' | 'round'>[], year: number, kind: MeetingKind): number {
  const rounds = meetings.filter((m) => m.year === year && m.kind === kind).map((m) => m.round);
  return rounds.length ? Math.max(...rounds) + 1 : 1;
}

/** 2026년 제1회 정례회의 */
export function roundLabel(year: number, round: number, kind: MeetingKind): string {
  return `${year}년 제${round}회 ${kind}회의`;
}

/** 2026년 제1회 정례회의(상반기) */
export function meetingLabel(m: Pick<Meeting, 'year' | 'round' | 'kind' | 'half'>): string {
  return roundLabel(m.year, m.round, m.kind) + (m.half ? `(${m.half})` : '');
}

/** 텃밭 상세의 “위원회 심의 완료” 배지 문구: 2026년 제1회 정례회의, 2026.01.22 */
export function designationLabel(d: Designation): string {
  const year = Number(d.decidedAt.slice(0, 4));
  return `${roundLabel(year, d.round, d.meetingKind)}, ${formatDate(d.decidedAt)}`;
}
