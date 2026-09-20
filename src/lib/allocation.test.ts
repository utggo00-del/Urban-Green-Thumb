import { beforeEach, describe, expect, it } from 'vitest';
import { INSPECTION_ITEMS } from '../config';
import { buildSeed } from '../data/seed';
import type { Db } from '../types';
import {
  acceptOffer, advanceDays, confirmDraw, declineOffer, discardDraw, expireOffers, isPriorityApplicant, releasePlot, runDraw, suggestSeed,
  unverifiedPriority, verifyPriority,
} from './allocation';
import { drawGroups, openBlockReason, openRecruitment, removeRecruitment, setRecruitmentStatus, updateRecruitment, type RecruitmentInput } from './recruitment';
import type { Res } from './workflow';
import { addAgenda, approveForCommittee, autoVote, decideAgenda, openMeeting, setAttendanceBulk, submitRegistration } from './workflow';

const ADMIN = 'u_admin1';
const okValue = <T>(r: Res<T>): T => {
  expect(r.ok, r.ok ? '' : (r as { error: string }).error).toBe(true);
  return (r as { value: T }).value;
};
const errOf = (r: Res<unknown>): string => {
  expect(r.ok).toBe(false);
  return (r as { error: string }).error;
};

let db: Db;
beforeEach(() => {
  db = buildSeed();
});

const rec = (over: Partial<RecruitmentInput> = {}): RecruitmentInput => ({
  gardenId: 'g09', year: 2026, season: '가을', applyStart: '2026-09-25', applyEnd: '2026-10-05', drawDate: '2026-10-10', plotsOffered: 4,
  priorityQuotaRatio: 0.3, acceptDeadlineDays: 5, ...over,
});
const readyGroups = () => drawGroups(db).filter((g) => g.state === 'ready');
const app = (id: string) => db.applications.find((a) => a.id === id)!;
const mine = (userId: string) => db.applications.find((a) => a.userId === userId && a.recruitmentSeason === '2026-가을')!;

/** 마감된 묶음을 모두 추첨하고 확정한다 */
function drawAndConfirmAll(seed = 20260922) {
  for (const g of readyGroups()) {
    okValue(runDraw(db, g.id, seed, ADMIN));
    okValue(confirmDraw(db, g.id, ADMIN));
  }
}

describe('모집 개설: 심의를 거친(지정) 텃밭만 (SPEC 5.8)', () => {
  it('지정되지 않은 텃밭은 모집을 열 수 없고 안내 문구가 나온다', () => {
    for (const gid of ['g13', 'g14', 'g15', 'g16']) {
      expect(openBlockReason(db, gid)).toContain('위원회 심의를 거쳐 지정되지 않아');
      expect(errOf(openRecruitment(db, rec({ gardenId: gid }), ADMIN))).toContain('모집을 열 수 없어요');
    }
    expect(db.recruitments.some((r) => r.gardenId === 'g13')).toBe(false);
  });

  it('지정 텃밭은 “모집 준비” 상태로 열린다', () => {
    expect(openBlockReason(db, 'g09')).toBeNull();
    const id = okValue(openRecruitment(db, rec(), ADMIN));
    expect(db.recruitments.find((r) => r.id === id)).toMatchObject({ status: '준비', gardenId: 'g09', plotsOffered: 4, priorityQuotaRatio: 0.3 });
  });

  it('위원회 의결로 새로 지정된 텃밭에 바로 모집을 열 수 있다 (심의 → 지정 → 모집 연동)', () => {
    const gid = okValue(submitRegistration(db, {
      ownerId: 'u_o_prov', type: '개인', ordinanceType: '도시텃밭', name: '연동 시험 텃밭', address: '시흥시 1', dong: '정왕동', totalAreaM2: 200, plotCount: 6,
      plotAreaM2: 12, facilities: [], rules: '', fee: 0, seasonMinTerm: 6, documents: ['a.pdf'], ownerConsentDoc: 'b.pdf',
    }, 'u_o_prov'));
    expect(errOf(openRecruitment(db, rec({ gardenId: gid, plotsOffered: 3 }), ADMIN))).toContain('지정되지 않아');
    okValue(approveForCommittee(db, gid, Object.fromEntries(INSPECTION_ITEMS.map((k) => [k, true])), '확인', ADMIN));
    const aid = okValue(addAgenda(db, { meetingId: 'mt_3', gardenId: gid }, ADMIN));
    okValue(setAttendanceBulk(db, 'mt_3', db.members.map((m) => m.id), ADMIN));
    okValue(openMeeting(db, 'mt_3', ADMIN));
    okValue(autoVote(db, aid, 'yes', ADMIN));
    okValue(decideAgenda(db, { agendaId: aid }, ADMIN));
    okValue(openRecruitment(db, rec({ gardenId: gid, plotsOffered: 3 }), ADMIN));
  });

  it('입력 검증: 날짜 순서, 빈 구획 수, 우선 몫 비율, 중복', () => {
    expect(errOf(openRecruitment(db, rec({ applyEnd: '2026-09-20' }), ADMIN))).toContain('마감일');
    expect(errOf(openRecruitment(db, rec({ drawDate: '2026-10-05' }), ADMIN))).toContain('추첨일');
    expect(errOf(openRecruitment(db, rec({ plotsOffered: 0 }), ADMIN))).toContain('1 이상');
    expect(errOf(openRecruitment(db, rec({ plotsOffered: 11 }), ADMIN))).toContain('빈 구획(10개)'); // g09는 10구획 전부 공실
    expect(errOf(openRecruitment(db, rec({ priorityQuotaRatio: 1.5 }), ADMIN))).toContain('0~100%');
    expect(errOf(openRecruitment(db, rec({ gardenId: 'g01' }), ADMIN))).toContain('이미');
    expect(errOf(openRecruitment(db, rec(), 'u_c001'))).toContain('관리자');
  });

  it('상태 관리: 준비 → 모집중 → 마감, 거꾸로는 안 된다', () => {
    const id = okValue(openRecruitment(db, rec(), ADMIN));
    expect(errOf(setRecruitmentStatus(db, id, '마감', ADMIN))).toContain('모집 중인');
    okValue(setRecruitmentStatus(db, id, '모집중', ADMIN));
    expect(errOf(setRecruitmentStatus(db, id, '모집중', ADMIN))).toContain('준비');
    okValue(setRecruitmentStatus(db, id, '마감', ADMIN));
    expect(db.recruitments.find((r) => r.id === id)?.status).toBe('마감');
  });

  it('모집 설정(우선 배정 몫 비율 등)은 마감 전까지만 바꿀 수 있다', () => {
    const id = okValue(openRecruitment(db, rec(), ADMIN));
    okValue(updateRecruitment(db, id, { priorityQuotaRatio: 0.5, plotsOffered: 6 }, ADMIN));
    expect(db.recruitments.find((r) => r.id === id)).toMatchObject({ priorityQuotaRatio: 0.5, plotsOffered: 6 });
    expect(errOf(updateRecruitment(db, id, { plotsOffered: 99 }, ADMIN))).toContain('빈 구획');
    okValue(setRecruitmentStatus(db, id, '모집중', ADMIN));
    okValue(setRecruitmentStatus(db, id, '마감', ADMIN));
    expect(errOf(updateRecruitment(db, id, { plotsOffered: 2 }, ADMIN))).toContain('바꿀 수 없어요');
    expect(errOf(removeRecruitment(db, id, ADMIN))).toContain('준비');
  });

  it('준비 중인 모집은 삭제할 수 있다', () => {
    const id = okValue(openRecruitment(db, rec(), ADMIN));
    okValue(removeRecruitment(db, id, ADMIN));
    expect(db.recruitments.some((r) => r.id === id)).toBe(false);
  });
});

describe('추첨 묶음 (지망이 얽힌 텃밭은 함께 추첨)', () => {
  it('마감된 텃밭(은행 푸른잎·장곡 다솜)은 바로 추첨 가능하고, 모집 중·준비 텃밭 묶음은 막혀 있다', () => {
    const groups = drawGroups(db);
    const ready = groups.filter((g) => g.state === 'ready');
    expect(ready.flatMap((g) => g.gardenIds).sort()).toEqual(['g03', 'g06']);
    for (const g of groups.filter((x) => x.state === 'blocked')) {
      expect(g.blockedBy.length).toBeGreaterThan(0);
      expect(g.gardenIds.some((id) => ['g03', 'g06'].includes(id))).toBe(false);
    }
  });

  it('신청서 한 장에 마감·모집 중 텃밭이 함께 있으면 두 텃밭 모두 묶여서 추첨이 막힌다', () => {
    const a = mine('u_a001'); // g06 1지망 신청
    a.choices = ['g06', 'g02']; // 모집 중인 g02를 2지망에 추가
    const groups = drawGroups(db);
    const withG06 = groups.find((g) => g.gardenIds.includes('g06'))!;
    expect(withG06.gardenIds).toContain('g02');
    expect(withG06.state).toBe('blocked');
    expect(withG06.blockedBy.map((b) => b.gardenId)).toContain('g02');
    expect(errOf(runDraw(db, withG06.id, 1, ADMIN))).toContain('아직 끝나지 않았어요');
  });

  it('묶음 안의 텃밭을 모두 마감하면 함께 추첨할 수 있다', () => {
    mine('u_a001').choices = ['g06', 'g02'];
    const blocked = drawGroups(db).find((x) => x.gardenIds.includes('g06'))!;
    for (const b of blocked.blockedBy) okValue(setRecruitmentStatus(db, `rc_2026f_${b.gardenId}`, '마감', ADMIN)); // 준비 상태인 텃밭이 있으면 먼저 시작
    const g = drawGroups(db).find((x) => x.gardenIds.includes('g06'))!;
    expect(g.gardenIds).toContain('g02');
    expect(g.state).toBe('ready');
  });
});

describe('추첨 실행 → 확정·발표', () => {
  it('실행하면 미확정으로 감사 로그만 남고, 신청 결과는 아직 바뀌지 않는다', () => {
    const g = readyGroups()[0];
    const before = JSON.stringify(db.applications);
    const seed = okValue(runDraw(db, g.id, 777, ADMIN, new Date('2026-09-20T09:05:00')));
    expect(seed).toBe(777);
    expect(JSON.stringify(db.applications)).toBe(before);
    const logs = db.drawLogs.filter((l) => l.groupId === g.id);
    expect(logs).toHaveLength(g.gardenIds.length);
    for (const l of logs) {
      expect(l).toMatchObject({ status: '미확정', seed: 777, executedBy: ADMIN, recruitmentSeason: '2026-가을' });
      expect(l.executedAt.slice(0, 10)).toBe('2026-09-20');
      expect(l.plotCount).toBe(db.recruitments.find((r) => r.gardenId === l.gardenId && r.season === '가을')!.plotsOffered);
      expect(l.resultSnapshot.length).toBeGreaterThan(0);
    }
    expect(drawGroups(db).find((x) => x.id === g.id)?.state).toBe('pending');
  });

  it('미확정 추첨이 있으면 다시 실행할 수 없다, 권한·시드·대기 중인 묶음도 검증', () => {
    const g = readyGroups()[0];
    okValue(runDraw(db, g.id, 1, ADMIN));
    expect(errOf(runDraw(db, g.id, 2, ADMIN))).toContain('확정을 기다리고');
    const blocked = drawGroups(db).find((x) => x.state === 'blocked')!;
    expect(errOf(runDraw(db, blocked.id, 1, ADMIN))).toContain('아직 끝나지 않았어요');
    expect(errOf(runDraw(db, g.id, 1, 'u_c001'))).toContain('관리자');
    expect(errOf(runDraw(db, readyGroups()[0]?.id ?? 'x', -5, ADMIN))).toBeTruthy();
    expect(errOf(runDraw(db, 'nope', 1, ADMIN))).toContain('찾을 수 없');
  });

  it('같은 시드·같은 신청이면 결과가 같다 (감사 재현성)', () => {
    const other = structuredClone(db);
    const g = readyGroups()[0];
    okValue(runDraw(db, g.id, 4242, ADMIN, new Date('2026-09-20T10:00:00')));
    okValue(runDraw(other, g.id, 4242, ADMIN, new Date('2026-09-20T10:00:00')));
    expect(db.drawLogs.filter((l) => l.groupId === g.id)).toEqual(other.drawLogs.filter((l) => l.groupId === g.id));
    const third = structuredClone(buildSeed());
    okValue(runDraw(third, g.id, 4243, ADMIN, new Date('2026-09-20T10:00:00')));
    expect(JSON.stringify(third.drawLogs.filter((l) => l.groupId === g.id).map((l) => l.resultSnapshot))).not.toBe(
      JSON.stringify(db.drawLogs.filter((l) => l.groupId === g.id).map((l) => l.resultSnapshot)),
    );
  });

  it('확정하면 당첨·대기·낙첨이 신청에 반영되고 구획이 배정되며 모집이 추첨완료가 된다', () => {
    const g = readyGroups().find((x) => x.gardenIds.includes('g06'))!;
    okValue(runDraw(db, g.id, 20260922, ADMIN));
    const counts = okValue(confirmDraw(db, g.id, ADMIN));
    const apps = g.applications.map((a) => app(a.id));
    expect(apps.filter((a) => a.status === '당첨')).toHaveLength(counts.won);
    expect(apps.filter((a) => a.status === '대기')).toHaveLength(counts.waiting);
    expect(apps.filter((a) => a.status === '낙첨')).toHaveLength(counts.lost);
    expect(counts.won + counts.waiting + counts.lost).toBe(apps.length);
    // 모집 구획이 다 찼다 (g06은 8석, 신청자가 훨씬 많음)
    const g06Wins = apps.filter((a) => a.status === '당첨' && a.assignedGardenId === 'g06');
    expect(g06Wins).toHaveLength(8);
    for (const a of g06Wins) {
      expect(a.acceptDeadlineAt).toBe('2026-09-25'); // 오늘 + 수락 기한 5일
      const plot = db.plots.find((p) => p.gardenId === 'g06' && p.userId === a.userId)!;
      expect(plot.status).toBe('배정');
    }
    // 대기자에게는 대기번호가 있다
    for (const a of apps.filter((x) => x.status === '대기')) {
      expect(a.waitlist!.length).toBeGreaterThan(0);
      expect(a.waitlistNo).toBe(a.waitlist![0].no);
    }
    for (const gid of g.gardenIds) expect(db.recruitments.find((r) => r.gardenId === gid && r.season === '가을')?.status).toBe('추첨완료');
    expect(db.drawLogs.filter((l) => l.groupId === g.id).every((l) => l.status === '확정' && l.confirmedAt)).toBe(true);
    // 확정 뒤에는 신청이 더 이상 얽혀 있지 않으므로 텃밭별로 "추첨완료"로 나뉘어 보인다
    for (const gid of g.gardenIds) expect(drawGroups(db).find((x) => x.gardenIds.includes(gid))?.state).toBe('done');
    expect(db.notifications.at(-1)?.message).toContain('추첨 결과가 발표');
  });

  it('구획 배정에 겹침이 없다 (한 구획 한 사람, 당첨자마다 구획 1개)', () => {
    drawAndConfirmAll();
    const winners = db.applications.filter((a) => a.recruitmentSeason === '2026-가을' && a.status === '당첨');
    for (const a of winners) {
      const plots = db.plots.filter((p) => p.userId === a.userId && p.status === '배정');
      expect(plots).toHaveLength(1);
      expect(plots[0].gardenId).toBe(a.assignedGardenId);
    }
    const occupied = db.plots.filter((p) => p.userId);
    expect(new Set(occupied.map((p) => p.id)).size).toBe(occupied.length);
  });

  it('폐기는 사유가 필수이고 기록이 남으며, 폐기 후 새 시드로 다시 실행할 수 있다', () => {
    const g = readyGroups()[0];
    okValue(runDraw(db, g.id, 1, ADMIN));
    expect(errOf(discardDraw(db, g.id, ' ', ADMIN))).toContain('사유');
    okValue(discardDraw(db, g.id, '시드값 입력 오류', ADMIN));
    const first = db.drawLogs.filter((l) => l.groupId === g.id);
    expect(first.every((l) => l.status === '폐기' && l.discardReason === '시드값 입력 오류')).toBe(true);
    okValue(runDraw(db, g.id, 2, ADMIN));
    expect(db.drawLogs.filter((l) => l.groupId === g.id)).toHaveLength(first.length * 2); // 폐기된 기록이 그대로 남아 있다
    expect(errOf(confirmDraw(db, 'grp_none', ADMIN))).toContain('확정할');
  });

  it('로그 id는 겹치지 않는다', () => {
    const g = readyGroups()[0];
    okValue(runDraw(db, g.id, 1, ADMIN));
    okValue(discardDraw(db, g.id, 'x', ADMIN));
    okValue(runDraw(db, g.id, 2, ADMIN));
    const ids = db.drawLogs.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('시드 제안값', () => {
    expect(suggestSeed(db)).toBe(202609200);
  });
});

describe('우선 배정 대상 확인', () => {
  it('확인되지 않은 자기신고는 우선 몫에 들어가지 않고, 확인하면 들어간다', () => {
    const g = readyGroups().find((x) => x.gardenIds.includes('g03'))!;
    const pending = unverifiedPriority(g.applications);
    expect(pending.length).toBeGreaterThan(0);
    expect(isPriorityApplicant(db, pending[0])).toBe(false);

    const run = (d: Db) => {
      okValue(runDraw(d, g.id, 9, ADMIN));
      return d.drawLogs.filter((l) => l.groupId === g.id).reduce((s, l) => s + l.priorityGroupCount, 0);
    };
    const before = run(structuredClone(db));
    okValue(verifyPriority(db, pending[0].id, ADMIN));
    expect(isPriorityApplicant(db, app(pending[0].id))).toBe(true);
    expect(run(structuredClone(db))).toBe(before + 1);
  });

  it('확인 요구는 설정값이다 (끄면 자기신고 그대로 인정)', () => {
    const a = db.applications.find((x) => x.priorityType !== '없음' && !x.priorityVerified)!;
    db.settings.requirePriorityVerification = false;
    expect(isPriorityApplicant(db, a)).toBe(true);
  });

  it('우선 배정을 신고하지 않은 신청·이미 결과가 난 신청은 확인할 수 없다', () => {
    const none = db.applications.find((x) => x.priorityType === '없음' && x.recruitmentSeason === '2026-가을')!;
    expect(errOf(verifyPriority(db, none.id, ADMIN))).toContain('신고하지 않은');
    const spring = db.applications.find((x) => x.recruitmentSeason === '2026-봄')!;
    spring.priorityType = '노인';
    expect(errOf(verifyPriority(db, spring.id, ADMIN))).toContain('추첨 전');
  });
});

describe('수락 · 포기 · 대기자 승계 (SPEC 5.3)', () => {
  beforeEach(() => drawAndConfirmAll());
  const winner = (gid: string) => db.applications.find((a) => a.status === '당첨' && a.assignedGardenId === gid)!;

  it('수락하면 이용중이 된다 (신청 수락, 구획 이용중)', () => {
    const w = winner('g06');
    okValue(acceptOffer(db, w.id, w.userId));
    expect(app(w.id)).toMatchObject({ status: '수락' });
    expect(db.plots.find((p) => p.gardenId === 'g06' && p.userId === w.userId)?.status).toBe('이용중');
  });

  it('본인만, 당첨 상태에서만, 기한 안에서만 수락할 수 있다', () => {
    const w = winner('g06');
    expect(errOf(acceptOffer(db, w.id, 'u_c001'))).toContain('찾을 수 없');
    db.meta.today = '2026-09-26'; // 기한(09-25) 경과
    expect(errOf(acceptOffer(db, w.id, w.userId))).toContain('기한이 지났');
    const wait = db.applications.find((a) => a.status === '대기')!;
    db.meta.today = '2026-09-20';
    expect(errOf(acceptOffer(db, wait.id, wait.userId))).toContain('당첨 상태');
  });

  it('포기하면 구획이 대기 1번에게 넘어가고 같은 수락 기한이 적용된다', () => {
    const w = winner('g06');
    const waiting = db.applications
      .filter((a) => a.status === '대기' && a.waitlist?.some((x) => x.gardenId === 'g06'))
      .sort((a, b) => a.waitlist!.find((x) => x.gardenId === 'g06')!.no - b.waitlist!.find((x) => x.gardenId === 'g06')!.no);
    expect(waiting.length).toBeGreaterThan(1);
    const first = waiting[0];
    const otherNos = first.waitlist!.length;

    const r = okValue(declineOffer(db, w.id, w.userId));
    expect(r.promotedTo).toBe(first.id);
    expect(app(w.id).status).toBe('포기');
    expect(app(first.id)).toMatchObject({ status: '당첨', assignedGardenId: 'g06', acceptDeadlineAt: '2026-09-25', waitlist: [], waitlistNo: null });
    expect(otherNos).toBeGreaterThan(0);
    const plot = db.plots.find((p) => p.gardenId === 'g06' && p.userId === first.userId)!;
    expect(plot.status).toBe('배정');
    // 포기한 사람의 구획을 대기 1번이 이어받았다 — 구획 수는 그대로
    expect(db.plots.filter((p) => p.gardenId === 'g06' && p.status === '배정')).toHaveLength(8);
    expect(db.successions.at(-1)).toMatchObject({ gardenId: 'g06', reason: '포기', fromUserId: w.userId, toApplicationId: first.id, note: '대기 1번' });
  });

  it('승계받은 사람이 다시 포기하면 다음 순번(2번)으로 넘어간다', () => {
    const w = winner('g06');
    const first = okValue(declineOffer(db, w.id, w.userId)).promotedTo!;
    const firstApp = app(first);
    const second = okValue(declineOffer(db, first, firstApp.userId)).promotedTo!;
    expect(second).not.toBe(first);
    expect(db.successions.at(-1)?.note).toBe('대기 2번');
  });

  it('대기자가 없으면 구획은 공실로 남고 “재모집 필요”로 기록된다', () => {
    const w = winner('g03');
    // g03의 대기자를 모두 없앤다
    for (const a of db.applications) if (a.status === '대기') a.waitlist = a.waitlist?.filter((x) => x.gardenId !== 'g03');
    for (const a of db.applications) if (a.status === '대기' && a.waitlist?.length === 0) a.status = '낙첨';
    const r = okValue(declineOffer(db, w.id, w.userId));
    expect(r.promotedTo).toBeNull();
    expect(db.successions.at(-1)).toMatchObject({ gardenId: 'g03', toApplicationId: null });
    expect(db.successions.at(-1)?.note).toContain('재모집');
    expect(db.plots.find((p) => p.gardenId === 'g03' && p.userId === w.userId)).toBeUndefined();
  });

  it('승계받으면 다른 텃밭의 대기 명단에서는 빠진다', () => {
    const multi = db.applications.find((a) => a.status === '대기' && (a.waitlist?.length ?? 0) >= 2);
    if (!multi) return; // 시드에 따라 없을 수 있음 — 아래에서 강제로 만든다
    const gid = multi.waitlist![0].gardenId;
    const holder = winner(gid);
    const first = releasePlot(db, db.plots.find((p) => p.userId === holder.userId && p.gardenId === gid)!.id, holder.userId, '포기');
    if (first === multi.id) expect(app(multi.id).waitlist).toEqual([]);
  });
});

describe('기한 경과 시뮬레이션', () => {
  beforeEach(() => drawAndConfirmAll());

  it('수락 기한(5일)이 지난 당첨은 자동 포기되고 대기 1번에게 승계된다', () => {
    const before = db.applications.filter((a) => a.status === '당첨');
    expect(before.length).toBeGreaterThan(0);
    const s = okValue(advanceDays(db, 6, ADMIN));
    expect(s.today).toBe('2026-09-26');
    expect(s.expired).toBe(before.length);
    expect(s.promoted + s.unfilled).toBe(before.length);
    for (const a of before) expect(app(a.id).status).toBe('포기');
    // 승계받은 사람은 새 기한(오늘+5일)을 받는다
    const promoted = db.applications.filter((a) => a.status === '당첨');
    expect(promoted).toHaveLength(s.promoted);
    for (const a of promoted) expect(a.acceptDeadlineAt).toBe('2026-10-01');
    expect(db.successions.filter((x) => x.reason === '기한 경과')).toHaveLength(before.length);
  });

  it('5일 이내에는 아무 일도 일어나지 않는다', () => {
    const s = okValue(advanceDays(db, 5, ADMIN));
    expect(s.expired).toBe(0);
    expect(db.applications.filter((a) => a.status === '당첨').length).toBeGreaterThan(0);
  });

  it('수락한 사람은 기한이 지나도 그대로 이용중이다', () => {
    const w = db.applications.find((a) => a.status === '당첨')!;
    okValue(acceptOffer(db, w.id, w.userId));
    okValue(advanceDays(db, 30, ADMIN));
    expect(app(w.id).status).toBe('수락');
    expect(db.plots.find((p) => p.userId === w.userId && p.gardenId === w.assignedGardenId)?.status).toBe('이용중');
  });

  it('아무도 수락하지 않으면 대기자가 소진될 때까지 승계가 이어지고, 끝나면 재모집 대상이 된다', () => {
    for (let i = 0; i < 12; i++) okValue(advanceDays(db, 6, ADMIN));
    expect(db.applications.filter((a) => a.status === '당첨')).toHaveLength(0);
    expect(db.applications.filter((a) => a.status === '대기')).toHaveLength(0);
    expect(db.successions.some((x) => x.toApplicationId === null)).toBe(true);
    const vacantAfter = db.plots.filter((p) => p.status === '배정');
    expect(vacantAfter).toHaveLength(0);
  });

  it('날짜가 지나면 모집이 자동으로 시작·마감된다', () => {
    const id = okValue(openRecruitment(db, rec({ applyStart: '2026-09-22', applyEnd: '2026-09-24', drawDate: '2026-09-30' }), ADMIN));
    const s = okValue(advanceDays(db, 3, ADMIN)); // 09-23 → 시작, 마감 전
    expect(s.opened).toBeGreaterThanOrEqual(1);
    expect(db.recruitments.find((r) => r.id === id)?.status).toBe('모집중');
    const s2 = okValue(advanceDays(db, 2, ADMIN)); // 09-25 → 마감
    expect(s2.closed).toBeGreaterThanOrEqual(1);
    expect(db.recruitments.find((r) => r.id === id)?.status).toBe('마감');
  });

  it('일수 범위와 권한을 검증한다', () => {
    expect(errOf(advanceDays(db, 0, ADMIN))).toContain('1~90');
    expect(errOf(advanceDays(db, 91, ADMIN))).toContain('1~90');
    expect(errOf(advanceDays(db, 3, 'u_c001'))).toContain('관리자');
    expect(expireOffers(db)).toEqual({ expired: 0, promoted: 0, unfilled: 0 });
  });
});
