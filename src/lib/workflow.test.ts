import { beforeEach, describe, expect, it } from 'vitest';
import { INSPECTION_ITEMS } from '../config';
import { buildSeed } from '../data/seed';
import { isPublished } from '../data/selectors';
import type { Db } from '../types';
import { tallyVotes } from './committee';
import { publishedViews } from './gardens';
import type { RegistrationInput } from './registration';
import {
  addAgenda, approveForCommittee, autoVote, castVote, closeMeeting, correctAgenda, createMeeting, decideAgenda, migrateGarden,
  openMeeting, proposableGardens, removeAgenda, requestSupplement, resubmitSupplement, setAttendance, setAttendanceBulk, submitRegistration,
  type Res,
} from './workflow';

const SEC = 'u_admin1'; // 간사
const NOT_SEC = 'u_admin2';
const OWNER = 'u_o_prov';

const okValue = <T>(r: Res<T>): T => {
  expect(r.ok, r.ok ? '' : (r as { error: string }).error).toBe(true);
  return (r as { value: T }).value;
};
const errOf = (r: Res<unknown>): string => {
  expect(r.ok).toBe(false);
  return (r as { error: string }).error;
};

const input = (over: Partial<RegistrationInput> = {}): RegistrationInput => ({
  ownerId: OWNER, type: '개인', ordinanceType: '도시텃밭', name: '테스트 마당 텃밭', address: '경기도 시흥시 정왕동 1-1', dong: '정왕동',
  totalAreaM2: 300, plotCount: 12, plotAreaM2: 12, facilities: ['water'], rules: '', fee: 30000,
  feeAccount: { bank: '가상은행', number: '000-00-0001', holder: '오가람' }, seasonMinTerm: 6,
  documents: ['토지대장.pdf'], ownerConsentDoc: '동의서.pdf', ...over,
});
const allChecked = Object.fromEntries(INSPECTION_ITEMS.map((k) => [k, true]));
const memberIds = (db: Db) => db.members.map((m) => m.id);

let db: Db;
beforeEach(() => {
  db = buildSeed();
});

/** 등록 → 검수 통과 → 하반기 정례회의(mt_3)에 상정 */
function registerAndPropose(over: Partial<RegistrationInput> = {}) {
  const gid = okValue(submitRegistration(db, input(over), OWNER));
  okValue(approveForCommittee(db, gid, allChecked, '서류 확인 완료', SEC));
  const aid = okValue(addAgenda(db, { meetingId: 'mt_3', gardenId: gid }, SEC));
  return { gid, aid };
}
const attend = (n: number) => okValue(setAttendanceBulk(db, 'mt_3', memberIds(db).slice(0, n), SEC));

describe('등록 신청', () => {
  it('검수중 상태로 만들어지고 시민에게는 공개되지 않는다', () => {
    const gid = okValue(submitRegistration(db, input(), OWNER));
    const g = db.gardens.find((x) => x.id === gid)!;
    expect(g.status).toBe('검수중');
    expect(g.ownerConsentDoc).toBe('동의서.pdf');
    expect(g.history?.[0].label).toBe('등록 신청');
    expect(isPublished(g)).toBe(false);
    expect(publishedViews(db).some((v) => v.garden.id === gid)).toBe(false);
    expect(db.plots.some((p) => p.gardenId === gid)).toBe(false); // 지정 전에는 구획도 없다
  });

  it('소유자 동의서·토지 서류·계좌(유료 시)가 없으면 등록할 수 없다', () => {
    expect(errOf(submitRegistration(db, input({ ownerConsentDoc: '' }), OWNER))).toContain('소유자 동의서');
    expect(errOf(submitRegistration(db, input({ documents: [] }), OWNER))).toContain('토지 서류');
    expect(errOf(submitRegistration(db, input({ feeAccount: undefined }), OWNER))).toContain('계좌');
    okValue(submitRegistration(db, input({ fee: 0, feeAccount: undefined }), OWNER)); // 무료면 계좌 불필요
  });

  it('면적·구획 수 검증', () => {
    expect(errOf(submitRegistration(db, input({ plotCount: 0 }), OWNER))).toContain('구획 수');
    expect(errOf(submitRegistration(db, input({ totalAreaM2: 100 }), OWNER))).toContain('전체 면적');
    expect(errOf(submitRegistration(db, input({ name: ' ' }), OWNER))).toContain('이름');
  });

  it('본인 소유만 신청 가능, 공공 텃밭은 관리자만 대리 등록', () => {
    expect(errOf(submitRegistration(db, input({ ownerId: 'u_o_p2' }), OWNER))).toContain('본인');
    expect(errOf(submitRegistration(db, input({ type: '공공', ownerId: 'u_o_city', fee: 0, feeAccount: undefined }), OWNER))).toContain('텃밭지원과');
    const gid = okValue(submitRegistration(db, input({ type: '공공', ownerId: 'u_o_city', fee: 0, feeAccount: undefined }), SEC));
    expect(db.gardens.find((g) => g.id === gid)?.feeAccount).toBeUndefined(); // 공공은 계좌 없음
  });
});

describe('실무 검수', () => {
  it('요건을 모두 확인하고 의견을 적어야 심의 상정(심의대기)된다', () => {
    const gid = okValue(submitRegistration(db, input(), OWNER));
    expect(errOf(approveForCommittee(db, gid, { ...allChecked, [INSPECTION_ITEMS[1]]: false }, '의견', SEC))).toContain('소유자 동의서');
    expect(errOf(approveForCommittee(db, gid, allChecked, '  ', SEC))).toContain('의견');
    expect(db.gardens.find((g) => g.id === gid)?.status).toBe('검수중'); // 실패하면 그대로
    okValue(approveForCommittee(db, gid, allChecked, '문제 없음', SEC));
    const g = db.gardens.find((x) => x.id === gid)!;
    expect(g.status).toBe('심의대기');
    expect(g.inspection?.opinion).toBe('문제 없음');
    expect(isPublished(g)).toBe(false); // 심의 전에는 여전히 비공개
  });

  it('보완 요청은 사유가 필수이고, 제공자가 자료를 다시 내면 검수 대기로 돌아온다', () => {
    const gid = okValue(submitRegistration(db, input(), OWNER));
    expect(errOf(requestSupplement(db, gid, ' '))).toContain('사유');
    okValue(requestSupplement(db, gid, '소유자 동의서 서명이 누락되었습니다.'));
    let g = db.gardens.find((x) => x.id === gid)!;
    expect(g.status).toBe('검수중');
    expect(g.reviewNote).toContain('서명');
    expect(errOf(approveForCommittee(db, gid, allChecked, '의견', SEC))).toContain('보완 요청 중');

    expect(errOf(resubmitSupplement(db, gid, { documents: ['a.pdf'], ownerConsentDoc: '', memo: '' }))).toContain('동의서');
    okValue(resubmitSupplement(db, gid, { documents: ['a.pdf'], ownerConsentDoc: '서명본.pdf', memo: '서명 완료' }));
    g = db.gardens.find((x) => x.id === gid)!;
    expect(g.reviewNote).toBeUndefined();
    expect(g.ownerConsentDoc).toBe('서명본.pdf');
    expect(g.history?.map((h) => h.label)).toEqual(['등록 신청', '보완 요청', '보완 자료 제출']);
    okValue(approveForCommittee(db, gid, allChecked, '보완 확인', SEC));
  });

  it('보완 요청이 없는 텃밭은 다시 제출할 수 없다', () => {
    const gid = okValue(submitRegistration(db, input(), OWNER));
    expect(errOf(resubmitSupplement(db, gid, { documents: ['a.pdf'], ownerConsentDoc: 'b.pdf', memo: '' }))).toContain('보완 요청');
  });
});

describe('회의 등록 (SPEC 5.7)', () => {
  it('정례회의는 회차를 연도별로 자동 부여한다', () => {
    const y2027 = okValue(createMeeting(db, { kind: '정례', half: '상반기', scheduledAt: '2027-02-10T14:00', place: '회의실' }, SEC));
    expect(db.meetings.find((m) => m.id === y2027)).toMatchObject({ year: 2027, round: 1, half: '상반기', status: '예정', totalMembers: 12 });
    const y2027h2 = okValue(createMeeting(db, { kind: '정례', half: '하반기', scheduledAt: '2027-09-10T14:00', place: '회의실' }, SEC));
    expect(db.meetings.find((m) => m.id === y2027h2)?.round).toBe(2);
  });

  it('정례회의는 연 2회: 같은 해 같은 반기를 또 등록할 수 없고, 반기와 월이 맞아야 한다', () => {
    expect(errOf(createMeeting(db, { kind: '정례', half: '하반기', scheduledAt: '2026-11-10T14:00', place: 'x' }, SEC))).toContain('이미 등록');
    expect(errOf(createMeeting(db, { kind: '정례', half: '상반기', scheduledAt: '2027-09-10T14:00', place: 'x' }, SEC))).toContain('하반기입니다');
    expect(errOf(createMeeting(db, { kind: '정례', scheduledAt: '2027-02-10T14:00', place: 'x' }, SEC))).toContain('상반기·하반기');
  });

  it('임시회의는 반기 없이 정례와 따로 회차를 센다', () => {
    const a = okValue(createMeeting(db, { kind: '임시', scheduledAt: '2026-10-01T10:00', place: '회의실' }, SEC));
    const b = okValue(createMeeting(db, { kind: '임시', scheduledAt: '2026-12-01T10:00', place: '회의실' }, SEC));
    expect(db.meetings.find((m) => m.id === a)).toMatchObject({ kind: '임시', half: null, round: 1 });
    expect(db.meetings.find((m) => m.id === b)?.round).toBe(2);
  });

  it('간사만 회의를 등록할 수 있다', () => {
    expect(errOf(createMeeting(db, { kind: '임시', scheduledAt: '2026-10-01T10:00', place: 'x' }, NOT_SEC))).toContain('간사');
    expect(errOf(createMeeting(db, { kind: '임시', scheduledAt: '', place: 'x' }, SEC))).toContain('일시');
  });
});

describe('안건 상정', () => {
  it('상정 대상은 심의대기·보류 텃밭 (시드: 두레·갯내음·언덕 위)', () => {
    expect(proposableGardens(db).map((g) => g.id).sort()).toEqual(['g13', 'g14', 'g15']);
  });

  it('검수를 통과하지 않은 텃밭·이미 상정된 텃밭은 상정할 수 없다', () => {
    expect(errOf(addAgenda(db, { meetingId: 'mt_3', gardenId: 'g16' }, SEC))).toContain('심의대기');
    expect(errOf(addAgenda(db, { meetingId: 'mt_3', gardenId: 'g01' }, SEC))).toContain('심의대기'); // 이미 지정
    okValue(addAgenda(db, { meetingId: 'mt_3', gardenId: 'g13' }, SEC));
    expect(errOf(addAgenda(db, { meetingId: 'mt_3', gardenId: 'g13' }, SEC))).toContain('이미');
    expect(errOf(addAgenda(db, { meetingId: 'mt_1', gardenId: 'g14' }, SEC))).toContain('개회 전');
  });

  it('상정하면 안건이 생기고, 텃밭 종류에 맞는 안건 유형·제목이 채워진다', () => {
    const aid = okValue(addAgenda(db, { meetingId: 'mt_3', gardenId: 'g13' }, SEC));
    expect(db.agendas.find((a) => a.id === aid)).toMatchObject({ kind: '도시텃밭 지정', result: '미의결', title: '은행 두레 공동체 텃밭 지정(안)', yes: 0 });
    expect(db.gardens.find((g) => g.id === 'g13')?.status).toBe('심의대기'); // 개회 전에는 심의대기 그대로
  });

  it('텃밭 없는 안건(계획 수립 등)은 제목이 필수이고, 도시텃밭 지정은 텃밭을 골라야 한다', () => {
    expect(errOf(addAgenda(db, { meetingId: 'mt_3', kind: '계획 수립·변경' }, SEC))).toContain('제목');
    expect(errOf(addAgenda(db, { meetingId: 'mt_3', kind: '도시텃밭 지정', title: 'x' }, SEC))).toContain('텃밭을 선택');
    okValue(addAgenda(db, { meetingId: 'mt_3', kind: '계획 수립·변경', title: '2027년 도시농업 활성화 계획(안)' }, SEC));
  });

  it('상정 취소는 개회 전 미의결 안건만', () => {
    const aid = okValue(addAgenda(db, { meetingId: 'mt_3', gardenId: 'g13' }, SEC));
    okValue(removeAgenda(db, aid, SEC));
    expect(db.agendas.some((a) => a.id === aid)).toBe(false);
    expect(proposableGardens(db).some((g) => g.id === 'g13')).toBe(true);
  });

  it('보류된 텃밭은 다음 회의에 재상정할 수 있고 사유는 이력에 남는다', () => {
    okValue(addAgenda(db, { meetingId: 'mt_3', gardenId: 'g15' }, SEC));
    const g = db.gardens.find((x) => x.id === 'g15')!;
    expect(g.status).toBe('심의대기');
    expect(g.reviewNote).toBeUndefined();
    expect(g.history?.some((h) => h.label === '재상정')).toBe(true);
    expect(g.history?.some((h) => h.label === '위원회 심의 보류')).toBe(true);
  });
});

describe('출석과 개회 (개회 요건: 재적 과반 출석)', () => {
  beforeEach(() => void registerAndPropose());

  it('출석 6/12명이면 개회할 수 없고, 7명이면 개회한다', () => {
    attend(6);
    const m = () => db.meetings.find((x) => x.id === 'mt_3')!;
    expect(m()).toMatchObject({ attendeeCount: 6, quorumMet: false });
    expect(errOf(openMeeting(db, 'mt_3', SEC))).toContain('개회 요건 미달');
    expect(m().status).toBe('예정');
    okValue(setAttendance(db, 'mt_3', 'cm_07', true));
    expect(m()).toMatchObject({ attendeeCount: 7, quorumMet: true });
    okValue(openMeeting(db, 'mt_3', SEC));
    expect(m().status).toBe('진행중');
  });

  it('개회하면 상정된 텃밭이 심의중이 된다', () => {
    attend(12);
    okValue(openMeeting(db, 'mt_3', SEC));
    const ag = db.agendas.filter((a) => a.meetingId === 'mt_3' && a.gardenId);
    expect(ag.length).toBe(1);
    expect(db.gardens.find((g) => g.id === ag[0].gardenId)?.status).toBe('심의중');
  });

  it('출석 체크는 개별로도 되고, 결석 처리하면 인원이 줄며 표는 지워진다', () => {
    attend(8);
    okValue(openMeeting(db, 'mt_3', SEC));
    const aid = db.agendas.find((a) => a.meetingId === 'mt_3')!.id;
    okValue(castVote(db, { agendaId: aid, memberId: 'cm_01', choice: '찬성', comment: '' }));
    okValue(setAttendance(db, 'mt_3', 'cm_01', false));
    expect(db.meetings.find((m) => m.id === 'mt_3')?.attendeeCount).toBe(7);
    expect(db.votes.some((v) => v.memberId === 'cm_01')).toBe(false);
    expect(errOf(setAttendance(db, 'mt_3', 'cm_99', true))).toContain('위원');
  });

  it('간사만 개회할 수 있다', () => {
    attend(12);
    expect(errOf(openMeeting(db, 'mt_3', NOT_SEC))).toContain('간사');
  });
});

describe('투표와 의결 — 가결 → 지정 → 공개', () => {
  it('전 과정: 등록 → 검수 → 상정 → 출석 → 개회 → 투표 → 의결 → 지정, 시민에게 공개되고 구획이 생긴다', () => {
    const { gid, aid } = registerAndPropose();
    attend(9);
    okValue(openMeeting(db, 'mt_3', SEC));
    okValue(castVote(db, { agendaId: aid, memberId: 'cm_05', choice: '찬성', comment: '동의서 확인함' }));
    okValue(autoVote(db, aid, 'yes', SEC));
    const m = db.meetings.find((x) => x.id === 'mt_3')!;
    expect(tallyVotes(db.votes, aid, m.attendeeIds)).toMatchObject({ yes: 9, no: 0, notVoted: 0 });

    expect(okValue(decideAgenda(db, { agendaId: aid }, SEC))).toBe('가결');
    const g = db.gardens.find((x) => x.id === gid)!;
    expect(g.status).toBe('지정');
    expect(g.designation).toMatchObject({ agendaId: aid, meetingId: 'mt_3', meetingKind: '정례', round: 2, decidedAt: '2026-09-20' });
    expect(db.plots.filter((p) => p.gardenId === gid)).toHaveLength(12);
    expect(publishedViews(db).some((v) => v.garden.id === gid)).toBe(true);
    expect(db.agendas.find((a) => a.id === aid)).toMatchObject({ result: '가결', yes: 9, no: 0, decidedAt: '2026-09-20' });
    expect(g.history?.at(-1)?.label).toContain('가결');
  });

  it('출석 과반 찬성 경계: 출석 7명에서 찬성 3표는 부결, 4표는 가결', () => {
    const { gid, aid } = registerAndPropose();
    attend(7);
    okValue(openMeeting(db, 'mt_3', SEC));
    okValue(autoVote(db, aid, 'short', SEC)); // 찬성 3, 반대 4
    expect(tallyVotes(db.votes, aid, db.meetings.find((m) => m.id === 'mt_3')!.attendeeIds)).toMatchObject({ yes: 3, no: 4 });
    expect(okValue(decideAgenda(db, { agendaId: aid }, SEC))).toBe('부결');
    const g = db.gardens.find((x) => x.id === gid)!;
    expect(g.status).toBe('부결');
    expect(g.reviewNote).toContain('부결');
    expect(g.reviewNote).toContain('4명 이상');
    expect(isPublished(g)).toBe(false);
    expect(db.plots.some((p) => p.gardenId === gid)).toBe(false);
  });

  it('찬성 4표(출석 7명)는 가결', () => {
    const { aid } = registerAndPropose();
    attend(7);
    okValue(openMeeting(db, 'mt_3', SEC));
    for (const id of ['cm_01', 'cm_02', 'cm_03', 'cm_04']) okValue(castVote(db, { agendaId: aid, memberId: id, choice: '찬성', comment: '' }));
    expect(okValue(decideAgenda(db, { agendaId: aid }, SEC))).toBe('가결'); // 미투표 3명은 출석에 포함되지만 4/7 > 1/2
  });

  it('찬성이 투표자 과반이어도 출석 과반이 아니면 부결 (출석 8명, 찬성 4·미투표 4)', () => {
    const { aid } = registerAndPropose();
    attend(8);
    okValue(openMeeting(db, 'mt_3', SEC));
    for (const id of ['cm_01', 'cm_02', 'cm_03', 'cm_04']) okValue(castVote(db, { agendaId: aid, memberId: id, choice: '찬성', comment: '' }));
    expect(okValue(decideAgenda(db, { agendaId: aid }, SEC))).toBe('부결');
  });

  it('부결 대신 보류로 처리하면 사유가 남고 다음 회의에 재상정할 수 있다', () => {
    const { gid, aid } = registerAndPropose();
    attend(8);
    okValue(openMeeting(db, 'mt_3', SEC));
    okValue(autoVote(db, aid, 'short', SEC));
    expect(okValue(decideAgenda(db, { agendaId: aid, asHold: true, note: '진입로 보완 필요' }, SEC))).toBe('보류');
    const g = db.gardens.find((x) => x.id === gid)!;
    expect(g.status).toBe('보류');
    expect(g.reviewNote).toContain('진입로 보완 필요');
    expect(proposableGardens(db).some((x) => x.id === gid)).toBe(true);
  });

  it('가결 요건을 채운 안건은 보류로 처리할 수 없다', () => {
    const { aid } = registerAndPropose();
    attend(8);
    okValue(openMeeting(db, 'mt_3', SEC));
    okValue(autoVote(db, aid, 'yes', SEC));
    expect(errOf(decideAgenda(db, { agendaId: aid, asHold: true }, SEC))).toContain('보류로 처리할 수 없');
  });

  it('직접 입력한 인원으로도 판정한다 (투표 집계 대신)', () => {
    const { aid } = registerAndPropose();
    attend(10);
    okValue(openMeeting(db, 'mt_3', SEC));
    expect(errOf(decideAgenda(db, { agendaId: aid, manual: { yes: 8, no: 3, abstain: 0 } }, SEC))).toContain('합'); // 8+3 > 10
    expect(okValue(decideAgenda(db, { agendaId: aid, manual: { yes: 6, no: 3, abstain: 1 } }, SEC))).toBe('가결');
  });

  it('개회 요건이 미달인 상태(개회 후 결석 처리)에서는 의결할 수 없다', () => {
    const { gid, aid } = registerAndPropose();
    attend(7);
    okValue(openMeeting(db, 'mt_3', SEC));
    okValue(autoVote(db, aid, 'yes', SEC));
    okValue(setAttendance(db, 'mt_3', 'cm_07', false)); // 6명으로 감소
    expect(errOf(decideAgenda(db, { agendaId: aid }, SEC))).toContain('개회 요건 미달');
    expect(db.agendas.find((a) => a.id === aid)?.result).toBe('미의결');
    expect(db.gardens.find((g) => g.id === gid)?.status).toBe('심의중');
  });

  it('개회 전에는 투표·의결할 수 없고, 출석하지 않은 위원은 투표할 수 없다', () => {
    const { aid } = registerAndPropose();
    attend(8);
    expect(errOf(castVote(db, { agendaId: aid, memberId: 'cm_01', choice: '찬성', comment: '' }))).toContain('개회 전');
    expect(errOf(decideAgenda(db, { agendaId: aid }, SEC))).toContain('개회');
    okValue(openMeeting(db, 'mt_3', SEC));
    expect(errOf(castVote(db, { agendaId: aid, memberId: 'cm_12', choice: '찬성', comment: '' }))).toContain('출석');
  });

  it('위원은 마음을 바꿔 다시 제출할 수 있다 (한 위원 한 표)', () => {
    const { aid } = registerAndPropose();
    attend(8);
    okValue(openMeeting(db, 'mt_3', SEC));
    okValue(castVote(db, { agendaId: aid, memberId: 'cm_02', choice: '찬성', comment: '' }));
    okValue(castVote(db, { agendaId: aid, memberId: 'cm_02', choice: '반대', comment: '재검토' }));
    expect(db.votes.filter((v) => v.agendaId === aid && v.memberId === 'cm_02')).toHaveLength(1);
    expect(db.votes.find((v) => v.memberId === 'cm_02')?.choice).toBe('반대');
  });

  it('간사만 의결할 수 있다', () => {
    const { aid } = registerAndPropose();
    attend(8);
    okValue(openMeeting(db, 'mt_3', SEC));
    okValue(autoVote(db, aid, 'yes', SEC));
    expect(errOf(decideAgenda(db, { agendaId: aid }, NOT_SEC))).toContain('간사');
  });
});

describe('의결 잠금·정정·회의 종료', () => {
  function decided() {
    const { gid, aid } = registerAndPropose();
    attend(9);
    okValue(openMeeting(db, 'mt_3', SEC));
    okValue(autoVote(db, aid, 'yes', SEC));
    okValue(decideAgenda(db, { agendaId: aid }, SEC));
    return { gid, aid };
  }

  it('의결이 확정되면 수정·재의결·투표가 막힌다', () => {
    const { aid } = decided();
    expect(errOf(decideAgenda(db, { agendaId: aid, manual: { yes: 0, no: 9, abstain: 0 } }, SEC))).toContain('수정할 수 없');
    expect(errOf(castVote(db, { agendaId: aid, memberId: 'cm_01', choice: '반대', comment: '' }))).toContain('바꿀 수 없');
    expect(db.agendas.find((a) => a.id === aid)?.result).toBe('가결');
  });

  it('정정이 필요하면 결과를 바꾸지 않고 정정 기록만 덧붙인다', () => {
    const { aid } = decided();
    expect(errOf(correctAgenda(db, aid, ' ', SEC))).toContain('정정 내용');
    okValue(correctAgenda(db, aid, '회의록 오기: 출석 9명 → 10명 (표결 결과 영향 없음)', SEC));
    const a = db.agendas.find((x) => x.id === aid)!;
    expect(a.result).toBe('가결');
    expect(a.yes).toBe(9);
    expect(a.corrections).toEqual([{ at: '2026-09-20', by: SEC, note: '회의록 오기: 출석 9명 → 10명 (표결 결과 영향 없음)' }]);
  });

  it('의결 전 안건에는 정정 기록을 남길 수 없다', () => {
    const { aid } = registerAndPropose();
    expect(errOf(correctAgenda(db, aid, '메모', SEC))).toContain('의결 전');
  });

  it('미의결 안건이 남아 있으면 회의를 종료할 수 없고, 모두 의결하면 회의록이 남는다', () => {
    const { aid } = registerAndPropose();
    const second = okValue(addAgenda(db, { meetingId: 'mt_3', gardenId: 'g13' }, SEC));
    attend(9);
    okValue(openMeeting(db, 'mt_3', SEC));
    okValue(autoVote(db, aid, 'yes', SEC));
    okValue(decideAgenda(db, { agendaId: aid }, SEC));
    expect(errOf(closeMeeting(db, 'mt_3', SEC))).toContain('1건');
    okValue(autoVote(db, second, 'yes', SEC));
    okValue(decideAgenda(db, { agendaId: second }, SEC));
    okValue(closeMeeting(db, 'mt_3', SEC));
    expect(db.meetings.find((m) => m.id === 'mt_3')).toMatchObject({ status: '종료', minutesDoc: '2026년_제2회_정례회의_회의록(가상).pdf' });
    expect(errOf(setAttendance(db, 'mt_3', 'cm_10', true))).toContain('종료');
  });
});

describe('기존 지정 텃밭 이관 입력', () => {
  const mig = (over = {}) => ({ garden: input({ type: '민간', ownerId: 'u_o_m1', isWeekendFarmOperator: true, name: '이관 농장' }), meetingKind: '정례' as const, round: 1, decidedAt: '2025-11-14', ...over });

  it('심의 회차·일자를 입력해 지정 상태로 등록하고 구획을 만든다', () => {
    const gid = okValue(migrateGarden(db, mig(), SEC));
    const g = db.gardens.find((x) => x.id === gid)!;
    expect(g.status).toBe('지정');
    expect(g.designation).toEqual({ agendaId: null, meetingId: null, meetingKind: '정례', round: 1, decidedAt: '2025-11-14', migrated: true });
    expect(db.plots.filter((p) => p.gardenId === gid)).toHaveLength(12);
    expect(publishedViews(db).some((v) => v.garden.id === gid)).toBe(true);
  });

  it('간사만, 유효한 일자·회차만', () => {
    expect(errOf(migrateGarden(db, mig(), NOT_SEC))).toContain('간사');
    expect(errOf(migrateGarden(db, mig({ decidedAt: '2027-01-01' }), SEC))).toContain('오늘 이전');
    expect(errOf(migrateGarden(db, mig({ decidedAt: '' }), SEC))).toContain('일자');
    expect(errOf(migrateGarden(db, mig({ round: 0 }), SEC))).toContain('회차');
    expect(errOf(migrateGarden(db, { ...mig(), garden: input({ ownerConsentDoc: '' }) }, SEC))).toContain('동의서');
  });
});
