// 텃밭 등록 → 실무 검수 → 위원회 심의 → 지정 까지의 상태 전이 (SPEC 5.6·5.7).
//
// 모든 함수는 넘겨받은 Db를 직접 고친다. 검증을 먼저 하고, 실패하면 아무것도 바꾸지 않은 채
// { ok: false, error }를 돌려준다. 화면은 data/workflowActions.ts를 통해 repo.update 안에서 호출한다.
import { COMMITTEE_RULES, INSPECTION_ITEMS } from '../config';
import type { AgendaKind, AgendaResult, Db, Garden, Meeting, MeetingHalf, MeetingKind, Plot, Vote, VoteChoice } from '../types';
import { isQuorumMet, judgeAgenda, minYesToPass, tallyVotes, validateCounts } from './committee';
import { hasErrors, buildGarden, nextGardenId, validateRegistration, type RegistrationInput } from './registration';
import { nextRound, roundLabel } from './meeting';

export type Res<T = undefined> = { ok: true; value: T } | { ok: false; error: string };
export const ok = <T>(value: T): Res<T> => ({ ok: true, value });
export const fail = (error: string): Res<never> => ({ ok: false, error });

// ───────── 조회 도우미 ─────────
const garden = (db: Db, id: string) => db.gardens.find((g) => g.id === id);
const meeting = (db: Db, id: string) => db.meetings.find((m) => m.id === id);
const agenda = (db: Db, id: string) => db.agendas.find((a) => a.id === id);
const addHistory = (g: Garden, at: string, label: string, note?: string) => {
  (g.history ??= []).push(note ? { at, label, note } : { at, label });
};
const isSecretary = (db: Db, userId: string) => !!db.users.find((u) => u.id === userId)?.isCommitteeSecretary;
const notSecretary = () => fail('위원회 간사(도시농업 담당주무관)만 할 수 있는 작업입니다.');

/** 지정되면 구획을 만든다 (이미 있으면 그대로). */
export function ensurePlots(db: Db, g: Garden): void {
  if (db.plots.some((p) => p.gardenId === g.id)) return;
  for (let n = 1; n <= g.plotCount; n++) {
    const plot: Plot = { id: `${g.id}_${String(n).padStart(2, '0')}`, gardenId: g.id, number: n, status: '공실', userId: null, warningCount: 0 };
    db.plots.push(plot);
  }
}

// ───────── 1. 제공자: 등록 신청 · 보완 제출 ─────────
/**
 * 텃밭 등록 신청. 공공 텃밭은 시가 소유·관리하므로 텃밭지원과(관리자)가 대리 등록하고,
 * 민간·개인 소유자는 본인 계정으로 신청한다. 절차(검수 → 심의 → 지정)는 모두 같다.
 */
export function submitRegistration(db: Db, input: RegistrationInput, byId: string): Res<string> {
  const errors = validateRegistration(input);
  if (hasErrors(errors)) return fail(Object.values(errors)[0]!);
  const by = db.users.find((u) => u.id === byId);
  if (!by) return fail('사용자를 찾을 수 없습니다.');
  if (input.type === '공공' && by.role !== '관리자') return fail('공공 텃밭은 텃밭지원과가 대리 등록합니다.');
  // 소유자는 본인 소유만 신청할 수 있고, 관리자는 소유자를 대신해 등록할 수 있다.
  if (by.role !== '관리자' && input.ownerId !== byId) return fail('본인 소유 텃밭만 등록 신청할 수 있습니다.');
  const g = buildGarden(db, input);
  db.gardens.push(g);
  return ok(g.id);
}

/** 보완 요청을 받은 제공자가 서류를 다시 제출한다. 검수중 상태로 돌아가 관리자 대기 목록에 다시 나타난다. */
export function resubmitSupplement(db: Db, gardenId: string, input: { documents: string[]; ownerConsentDoc: string; memo: string }): Res {
  const g = garden(db, gardenId);
  if (!g) return fail('텃밭을 찾을 수 없습니다.');
  if (g.status !== '검수중' || !g.reviewNote) return fail('보완 요청이 있는 텃밭만 다시 제출할 수 있습니다.');
  if (input.documents.length === 0) return fail('토지 서류를 1개 이상 첨부해 주세요.');
  if (!input.ownerConsentDoc) return fail('소유자 동의서를 첨부해 주세요.');
  g.documents = input.documents;
  g.ownerConsentDoc = input.ownerConsentDoc;
  g.reviewNote = undefined;
  addHistory(g, db.meta.today, '보완 자료 제출', input.memo.trim() || undefined);
  return ok(undefined);
}

// ───────── 2. 관리자: 실무 검수 ─────────
/** 서류·요건이 부족하면 사유를 적어 제공자에게 돌려보낸다. 상태는 검수중 그대로다. */
export function requestSupplement(db: Db, gardenId: string, note: string): Res {
  const g = garden(db, gardenId);
  if (!g) return fail('텃밭을 찾을 수 없습니다.');
  if (g.status !== '검수중') return fail('실무 검수 중인 텃밭만 보완을 요청할 수 있습니다.');
  if (!note.trim()) return fail('보완 요청 사유를 입력해 주세요.');
  g.reviewNote = note.trim();
  g.inspection = undefined;
  addHistory(g, db.meta.today, '보완 요청', note.trim());
  return ok(undefined);
}

/** 체크리스트를 모두 충족하면 심의 상정(심의대기)한다. 위원회 의결 전에는 시민에게 공개되지 않는다. */
export function approveForCommittee(db: Db, gardenId: string, checklist: Record<string, boolean>, opinion: string, byId: string): Res {
  const g = garden(db, gardenId);
  if (!g) return fail('텃밭을 찾을 수 없습니다.');
  if (g.status !== '검수중') return fail('실무 검수 중인 텃밭만 심의에 상정할 수 있습니다.');
  if (g.reviewNote) return fail('보완 요청 중입니다. 제공자가 자료를 다시 제출한 뒤 검수해 주세요.');
  const missing = INSPECTION_ITEMS.filter((k) => !checklist[k]);
  if (missing.length > 0) return fail(`확인하지 않은 요건이 있어요: ${missing[0]} (요건이 부족하면 보완 요청을 해 주세요)`);
  if (!opinion.trim()) return fail('검수 의견을 입력해 주세요. (심의위원이 열람합니다)');
  g.inspection = { checklist: { ...checklist }, opinion: opinion.trim(), inspectedAt: db.meta.today, inspectedBy: byId };
  g.status = '심의대기';
  addHistory(g, db.meta.today, '실무 검수 통과 · 심의 상정 대기');
  return ok(undefined);
}

// ───────── 3. 간사: 회의 · 안건 ─────────
export interface MeetingInput {
  kind: MeetingKind;
  /** 정례회의만 */
  half?: MeetingHalf;
  /** YYYY-MM-DDTHH:mm */
  scheduledAt: string;
  place: string;
}

export function createMeeting(db: Db, input: MeetingInput, byId: string): Res<string> {
  if (!isSecretary(db, byId)) return notSecretary();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input.scheduledAt)) return fail('회의 일시를 입력해 주세요.');
  if (!input.place.trim()) return fail('회의 장소를 입력해 주세요.');
  const year = Number(input.scheduledAt.slice(0, 4));
  const month = Number(input.scheduledAt.slice(5, 7));
  let half: MeetingHalf | null = null;
  if (input.kind === '정례') {
    if (!input.half) return fail('정례회의는 상반기·하반기를 선택해 주세요.');
    const expected: MeetingHalf = month <= 6 ? '상반기' : '하반기';
    if (input.half !== expected) return fail(`${month}월은 ${expected}입니다. 정례회의의 반기와 일시를 맞춰 주세요.`);
    if (db.meetings.some((m) => m.kind === '정례' && m.year === year && m.half === input.half)) {
      return fail(`${year}년 ${input.half} 정례회의는 이미 등록되어 있어요. (정례회의는 연 ${COMMITTEE_RULES.regularMeetingsPerYear}회)`);
    }
    half = input.half;
  }
  const active = db.members.filter((m) => m.isActive).length;
  if (active === 0 || active > COMMITTEE_RULES.maxMembers) return fail(`위원은 ${COMMITTEE_RULES.maxMembers}명 이내여야 합니다.`);
  const round = nextRound(db.meetings, year, input.kind);
  const id = `mt_${db.meetings.length + 1}`;
  db.meetings.push({
    id, kind: input.kind, half, year, round, scheduledAt: input.scheduledAt, place: input.place.trim(), status: '예정',
    attendeeIds: [], totalMembers: active, attendeeCount: 0, quorumMet: false,
  });
  return ok(id);
}

export interface AgendaInput {
  meetingId: string;
  gardenId?: string;
  kind?: AgendaKind;
  title?: string;
  summary?: string;
}

/** 가능한 상정 대상 텃밭: 실무 검수를 통과한(심의대기) 텃밭, 그리고 보류되어 재상정하는 텃밭 */
export const proposableGardens = (db: Db): Garden[] =>
  db.gardens.filter((g) => (g.status === '심의대기' || g.status === '보류') && !db.agendas.some((a) => a.gardenId === g.id && a.result === '미의결'));

export function addAgenda(db: Db, input: AgendaInput, byId: string): Res<string> {
  if (!isSecretary(db, byId)) return notSecretary();
  const m = meeting(db, input.meetingId);
  if (!m) return fail('회의를 찾을 수 없습니다.');
  if (m.status !== '예정') return fail('개회 전(예정) 회의에만 안건을 상정할 수 있습니다.');

  let kind = input.kind ?? '기타';
  let title = input.title?.trim() ?? '';
  let summary = input.summary?.trim() ?? '';
  if (input.gardenId) {
    const g = garden(db, input.gardenId);
    if (!g) return fail('텃밭을 찾을 수 없습니다.');
    if (g.status !== '심의대기' && g.status !== '보류') return fail('실무 검수를 통과한 텃밭(심의대기) 또는 보류된 텃밭만 상정할 수 있습니다.');
    if (db.agendas.some((a) => a.gardenId === g.id && a.result === '미의결')) return fail('이미 다른 회의에 상정된 텃밭입니다.');
    kind = g.ordinanceType === '상자텃밭' ? '상자텃밭 보급' : '도시텃밭 지정';
    title ||= `${g.name} 지정(안)`;
    summary ||= `${g.type} 텃밭 · ${g.ordinanceType} · ${g.plotCount}구획 (조례 제11조)`;
    if (g.status === '보류') {
      g.reviewNote = undefined;
      g.status = '심의대기';
      addHistory(g, db.meta.today, '재상정', `${roundLabel(m.year, m.round, m.kind)} 안건으로 다시 상정`);
    } else {
      addHistory(g, db.meta.today, '위원회 안건 상정', `${roundLabel(m.year, m.round, m.kind)}`);
    }
  } else {
    if (!title) return fail('안건 제목을 입력해 주세요.');
    if (kind === '도시텃밭 지정') return fail('도시텃밭 지정 안건은 텃밭을 선택해서 상정해 주세요.');
  }
  let n = db.agendas.filter((a) => a.meetingId === m.id).length + 1;
  while (db.agendas.some((a) => a.id === `ag_${m.id}_n${n}`)) n++;
  const id = `ag_${m.id}_n${n}`;
  db.agendas.push({ id, meetingId: m.id, kind, gardenId: input.gardenId ?? null, title, summary, result: '미의결', yes: 0, no: 0, abstain: 0, corrections: [] });
  return ok(id);
}

/** 개회 전 상정 취소 */
export function removeAgenda(db: Db, agendaId: string, byId: string): Res {
  if (!isSecretary(db, byId)) return notSecretary();
  const a = agenda(db, agendaId);
  if (!a) return fail('안건을 찾을 수 없습니다.');
  const m = meeting(db, a.meetingId)!;
  if (m.status !== '예정' || a.result !== '미의결') return fail('개회 전 회의의 미의결 안건만 취소할 수 있습니다.');
  db.agendas = db.agendas.filter((x) => x.id !== agendaId);
  db.votes = db.votes.filter((v) => v.agendaId !== agendaId);
  return ok(undefined);
}

// ───────── 4. 출석 · 개회 ─────────
function recount(m: Meeting) {
  m.attendeeCount = m.attendeeIds.length;
  m.quorumMet = isQuorumMet(m.totalMembers, m.attendeeCount);
}

/** 출석 체크 (간사 또는 위원 본인). 종료된 회의는 바꿀 수 없다. */
export function setAttendance(db: Db, meetingId: string, memberId: string, present: boolean): Res {
  const m = meeting(db, meetingId);
  if (!m) return fail('회의를 찾을 수 없습니다.');
  if (m.status === '종료') return fail('종료된 회의의 출석은 바꿀 수 없습니다.');
  if (!db.members.some((x) => x.id === memberId && x.isActive)) return fail('위원을 찾을 수 없습니다.');
  const has = m.attendeeIds.includes(memberId);
  if (present && !has) m.attendeeIds.push(memberId);
  if (!present && has) {
    m.attendeeIds = m.attendeeIds.filter((id) => id !== memberId);
    // 결석 처리된 위원의 미의결 안건 표는 지운다 (집계는 출석자 표만 세므로 일관성 유지용)
    const open = new Set(db.agendas.filter((a) => a.meetingId === meetingId && a.result === '미의결').map((a) => a.id));
    db.votes = db.votes.filter((v) => !(v.memberId === memberId && open.has(v.agendaId)));
  }
  recount(m);
  return ok(undefined);
}

/** (시연용) 출석 위원을 한꺼번에 지정한다. */
export function setAttendanceBulk(db: Db, meetingId: string, memberIds: string[], byId: string): Res {
  if (!isSecretary(db, byId)) return notSecretary();
  const m = meeting(db, meetingId);
  if (!m) return fail('회의를 찾을 수 없습니다.');
  if (m.status === '종료') return fail('종료된 회의의 출석은 바꿀 수 없습니다.');
  const valid = new Set(db.members.filter((x) => x.isActive).map((x) => x.id));
  m.attendeeIds = memberIds.filter((id) => valid.has(id));
  recount(m);
  return ok(undefined);
}

/** 개회. 재적 과반 출석이 아니면 열 수 없다. 개회하면 상정된 텃밭은 `심의중`이 된다. */
export function openMeeting(db: Db, meetingId: string, byId: string): Res {
  if (!isSecretary(db, byId)) return notSecretary();
  const m = meeting(db, meetingId);
  if (!m) return fail('회의를 찾을 수 없습니다.');
  if (m.status !== '예정') return fail('예정 상태의 회의만 개회할 수 있습니다.');
  recount(m);
  if (!m.quorumMet) return fail(`개회 요건 미달 — 출석 ${m.attendeeCount}명 / 재적 ${m.totalMembers}명 (재적 과반 출석 필요)`);
  m.status = '진행중';
  for (const a of db.agendas.filter((x) => x.meetingId === m.id && x.gardenId)) {
    const g = garden(db, a.gardenId!);
    if (g && g.status === '심의대기') {
      g.status = '심의중';
      addHistory(g, db.meta.today, '심의 시작', roundLabel(m.year, m.round, m.kind));
    }
  }
  return ok(undefined);
}

// ───────── 5. 위원: 투표 ─────────
export function castVote(db: Db, input: { agendaId: string; memberId: string; choice: VoteChoice; comment: string }): Res {
  const a = agenda(db, input.agendaId);
  if (!a) return fail('안건을 찾을 수 없습니다.');
  const m = meeting(db, a.meetingId)!;
  if (m.status === '예정') return fail('아직 개회 전입니다. 개회 후에 의견을 제출할 수 있어요.');
  if (m.status === '종료' || a.result !== '미의결') return fail('의결이 끝난 안건은 의견을 바꿀 수 없습니다.');
  if (!m.attendeeIds.includes(input.memberId)) return fail('출석 체크를 한 위원만 의견을 낼 수 있습니다.');
  const existing = db.votes.find((v) => v.agendaId === a.id && v.memberId === input.memberId);
  const vote: Vote = { id: `vote_${a.id}_${input.memberId}`, agendaId: a.id, memberId: input.memberId, choice: input.choice, comment: input.comment.trim(), votedAt: `${db.meta.today}T14:00` };
  if (existing) Object.assign(existing, vote);
  else db.votes.push(vote);
  return ok(undefined);
}

/**
 * (시연용) 출석했지만 아직 투표하지 않은 위원의 표를 채운다. 실제로는 각 위원이 자기 화면에서 투표한다.
 * 'yes': 모두 찬성 / 'short': 찬성이 가결 요건에 딱 1표 모자라도록 나머지는 반대
 */
export function autoVote(db: Db, agendaId: string, mode: 'yes' | 'short', byId: string): Res {
  if (!isSecretary(db, byId)) return notSecretary();
  const a = agenda(db, agendaId);
  if (!a) return fail('안건을 찾을 수 없습니다.');
  const m = meeting(db, a.meetingId)!;
  if (m.status !== '진행중' || a.result !== '미의결') return fail('진행 중인 회의의 미의결 안건에만 쓸 수 있습니다.');
  const voted = new Set(db.votes.filter((v) => v.agendaId === a.id).map((v) => v.memberId));
  const pending = m.attendeeIds.filter((id) => !voted.has(id));
  let needYes = mode === 'yes' ? pending.length : Math.max(0, minYesToPass(m.attendeeCount) - 1 - tallyVotes(db.votes, a.id, m.attendeeIds).yes);
  for (const memberId of pending) {
    const choice: VoteChoice = needYes > 0 ? '찬성' : '반대';
    if (needYes > 0) needYes--;
    db.votes.push({ id: `vote_${a.id}_${memberId}`, agendaId: a.id, memberId, choice, comment: '(시연용 자동 투표)', votedAt: `${db.meta.today}T14:00` });
  }
  return ok(undefined);
}

// ───────── 6. 간사: 의결 · 정정 · 종료 ─────────
export interface DecideInput {
  agendaId: string;
  /** 투표 집계 대신 직접 입력한 인원 (SPEC 3.2-3) */
  manual?: { yes: number; no: number; abstain: number };
  /** 가결 요건을 못 채웠을 때 부결 대신 보류로 처리 (위원장 판단) */
  asHold?: boolean;
  note?: string;
}

/** 의결 확정: 개회·가결 요건을 판정하고, 결과를 잠그고, 텃밭 상태를 바꾼다. */
export function decideAgenda(db: Db, input: DecideInput, byId: string): Res<AgendaResult> {
  if (!isSecretary(db, byId)) return notSecretary();
  const a = agenda(db, input.agendaId);
  if (!a) return fail('안건을 찾을 수 없습니다.');
  const m = meeting(db, a.meetingId)!;
  if (a.result !== '미의결') return fail('이미 의결된 안건은 수정할 수 없습니다. 정정이 필요하면 정정 기록을 남겨 주세요.');
  if (m.status !== '진행중') return fail('개회한 회의에서만 의결할 수 있습니다.');

  const t = tallyVotes(db.votes, a.id, m.attendeeIds);
  const yes = input.manual?.yes ?? t.yes;
  const no = input.manual?.no ?? t.no;
  const abstain = input.manual?.abstain ?? t.abstain;
  const counts = { total: m.totalMembers, attendees: m.attendeeCount, yes, no, abstain };
  const bad = validateCounts(counts);
  if (bad) return fail(bad);
  const j = judgeAgenda(counts);
  if (!j.canDecide) return fail(j.reason);
  if (input.asHold && j.passed) return fail('가결 요건을 충족한 안건은 보류로 처리할 수 없습니다.');

  const result: AgendaResult = j.passed ? '가결' : input.asHold ? '보류' : '부결';
  a.yes = yes;
  a.no = no;
  a.abstain = abstain;
  a.result = result;
  a.decidedAt = db.meta.today;

  const g = a.gardenId ? garden(db, a.gardenId) : undefined;
  if (g) {
    const label = roundLabel(m.year, m.round, m.kind);
    const note = input.note?.trim();
    if (result === '가결') {
      g.status = '지정';
      g.reviewNote = undefined;
      g.designation = { agendaId: a.id, meetingId: m.id, meetingKind: m.kind, round: m.round, decidedAt: db.meta.today };
      ensurePlots(db, g);
      addHistory(g, db.meta.today, `위원회 심의 가결 → 지정`, `${label} · 찬성 ${yes}/출석 ${m.attendeeCount}명`);
    } else if (result === '부결') {
      g.status = '부결';
      g.reviewNote = `부결(${label}): 찬성 ${yes}명으로 가결 요건(출석 ${m.attendeeCount}명 과반 = ${minYesToPass(m.attendeeCount)}명 이상)에 못 미쳤습니다.${note ? ` ${note}` : ''}`;
      addHistory(g, db.meta.today, '위원회 심의 부결', g.reviewNote);
    } else {
      g.status = '보류';
      g.reviewNote = `보류(${label}): ${note || '보완 후 다음 회의에 다시 상정해 주세요.'}`;
      addHistory(g, db.meta.today, '위원회 심의 보류', g.reviewNote);
    }
  }
  return ok(result);
}

/** 잠긴 의결은 고치지 않고, 정정 기록만 덧붙인다. */
export function correctAgenda(db: Db, agendaId: string, note: string, byId: string): Res {
  if (!isSecretary(db, byId)) return notSecretary();
  const a = agenda(db, agendaId);
  if (!a) return fail('안건을 찾을 수 없습니다.');
  if (a.result === '미의결') return fail('의결 전에는 정정 기록을 남길 수 없습니다.');
  if (!note.trim()) return fail('정정 내용을 입력해 주세요.');
  a.corrections.push({ at: db.meta.today, by: byId, note: note.trim() });
  return ok(undefined);
}

/** 모든 안건이 의결되면 회의를 종료하고 회의록(모의)을 남긴다. */
export function closeMeeting(db: Db, meetingId: string, byId: string): Res {
  if (!isSecretary(db, byId)) return notSecretary();
  const m = meeting(db, meetingId);
  if (!m) return fail('회의를 찾을 수 없습니다.');
  if (m.status !== '진행중') return fail('진행 중인 회의만 종료할 수 있습니다.');
  const open = db.agendas.filter((a) => a.meetingId === m.id && a.result === '미의결');
  if (open.length > 0) return fail(`아직 의결하지 않은 안건이 ${open.length}건 있어요.`);
  m.status = '종료';
  m.minutesDoc = `${m.year}년_제${m.round}회_${m.kind}회의_회의록(가상).pdf`;
  return ok(undefined);
}

// ───────── 7. 간사: 기존 지정 텃밭 이관 등록 ─────────
export interface MigrateInput {
  garden: RegistrationInput;
  meetingKind: MeetingKind;
  /** 해당 연도 안에서의 회차 */
  round: number;
  decidedAt: string;
}

/** 이미 위원회 심의를 거쳐 조성된 텃밭을 회차·일자를 입력해 `지정` 상태로 등록한다. */
export function migrateGarden(db: Db, input: MigrateInput, byId: string): Res<string> {
  if (!isSecretary(db, byId)) return notSecretary();
  const errors = validateRegistration(input.garden);
  if (hasErrors(errors)) return fail(Object.values(errors)[0]!);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.decidedAt)) return fail('심의(의결) 일자를 입력해 주세요.');
  if (input.decidedAt > db.meta.today) return fail('심의 일자는 오늘 이전이어야 합니다.');
  if (!Number.isInteger(input.round) || input.round < 1) return fail('심의 회차는 1 이상의 정수로 입력해 주세요.');
  const id = nextGardenId(db);
  const g = buildGarden(db, input.garden);
  g.id = id;
  g.status = '지정';
  g.designation = { agendaId: null, meetingId: null, meetingKind: input.meetingKind, round: input.round, decidedAt: input.decidedAt, migrated: true };
  g.inspection = { checklist: Object.fromEntries(INSPECTION_ITEMS.map((k) => [k, true])), opinion: '기존 조성 텃밭 이관 등록(심의 회차·일자 입력)', inspectedAt: db.meta.today, inspectedBy: byId };
  g.history = [
    { at: db.meta.today, label: '기존 지정 텃밭 이관 등록', note: `${roundLabel(Number(input.decidedAt.slice(0, 4)), input.round, input.meetingKind)}, ${input.decidedAt} 심의` },
  ];
  db.gardens.push(g);
  ensurePlots(db, g);
  return ok(id);
}
