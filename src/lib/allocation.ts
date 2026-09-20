// 추첨 실행·확정, 당첨 수락·포기, 대기자 승계, 기한 경과 (SPEC 3.2-5·6, 5.2·5.3).
// 모든 함수는 넘겨받은 Db를 직접 고친다. 검증을 먼저 하고 실패하면 아무것도 바꾸지 않는다.
import type { Application, Db, DrawLog, DrawResultRow, SeasonKey } from '../types';
import { addDays, usageEndOf } from './date';
import { drawGroup, type DrawApplicant, type WinGroup } from './draw';
import { drawGroups, isDrawable } from './recruitment';
import { fail, ok, type Res } from './workflow';

const isAdmin = (db: Db, id: string) => db.users.find((u) => u.id === id)?.role === '관리자';
const notAdmin = () => fail('텃밭지원과 관리자만 할 수 있는 작업입니다.');
const pad = (n: number) => String(n).padStart(2, '0');

/** 우선 몫 추첨 대상: 자기신고 + (설정에 따라) 관리자 확인 */
export const isPriorityApplicant = (db: Db, a: Application): boolean =>
  a.priorityType !== '없음' && (!db.settings.requirePriorityVerification || a.priorityVerified);

/** 자기신고했지만 아직 확인하지 않은 우선 배정 신청 */
export const unverifiedPriority = (apps: readonly Application[]) => apps.filter((a) => a.priorityType !== '없음' && !a.priorityVerified);

export function verifyPriority(db: Db, applicationId: string, byId: string): Res {
  if (!isAdmin(db, byId)) return notAdmin();
  const a = db.applications.find((x) => x.id === applicationId);
  if (!a) return fail('신청을 찾을 수 없습니다.');
  if (a.priorityType === '없음') return fail('우선 배정을 신고하지 않은 신청입니다.');
  if (!isDrawable(a)) return fail('추첨 전(접수·추첨대기) 신청만 확인할 수 있습니다.');
  a.priorityVerified = true;
  return ok(undefined);
}

// ───────── 추첨 실행 ─────────

/** 추첨 시드 제안값: 기준일 + 묶음 번호. 관리자가 바꿀 수 있고, 어떤 값이든 로그에 남는다. */
export const suggestSeed = (db: Db): number => Number(db.meta.today.replaceAll('-', '')) * 10 + (db.drawLogs.filter((l) => l.executedAt.startsWith(db.meta.today)).length % 10);

/**
 * 추첨 실행. 결과는 "미확정"으로 감사 로그에만 기록되고, 시민에게는 공개되지 않는다.
 * 관리자가 요약을 확인하고 확정·발표해야 신청 결과와 구획에 반영된다.
 */
export function runDraw(db: Db, groupId: string, seed: number, byId: string, now = new Date()): Res<number> {
  if (!isAdmin(db, byId)) return notAdmin();
  if (!Number.isInteger(seed) || seed < 0) return fail('시드값은 0 이상의 정수여야 해요.');
  const group = drawGroups(db).find((g) => g.id === groupId);
  if (!group) return fail('추첨 대상을 찾을 수 없습니다.');
  if (group.state === 'pending') return fail('이미 실행한 추첨이 확정을 기다리고 있어요. 확정하거나 폐기한 뒤 다시 실행해 주세요.');
  if (group.state === 'done') return fail('이미 추첨이 끝난 텃밭입니다.');
  if (group.state === 'blocked') {
    const names = group.blockedBy.map((b) => db.gardens.find((g) => g.id === b.gardenId)?.name).join(', ');
    return fail(`함께 추첨해야 하는 텃밭의 모집이 아직 끝나지 않았어요: ${names}`);
  }

  const applicants: DrawApplicant[] = group.applications.map((a) => ({
    applicationId: a.id,
    userId: a.userId,
    choices: a.choices.filter((c) => group.gardenIds.includes(c)),
    isPriority: isPriorityApplicant(db, a),
  }));
  const outcome = drawGroup(
    group.recruitments.map((r) => ({ gardenId: r.gardenId, plots: r.plotsOffered, priorityQuotaRatio: r.priorityQuotaRatio })),
    applicants,
    { seed, waitlistRatio: db.settings.waitlistRatio },
  );

  const at = `${db.meta.today}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  for (const g of outcome.gardens) {
    const rec = group.recruitments.find((r) => r.gardenId === g.gardenId)!;
    const rows: DrawResultRow[] = [
      ...g.winners.map((w) => ({ applicationId: w.applicationId, userId: w.userId, result: '당첨' as const, group: w.group, choiceRank: w.choiceRank })),
      ...g.waitlist.map((w) => ({ applicationId: w.applicationId, userId: w.userId, result: '대기' as const, waitlistNo: w.no, choiceRank: w.choiceRank })),
      ...g.lost.map((l) => ({ applicationId: l.applicationId, userId: l.userId, result: '낙첨' as const, choiceRank: l.choiceRank })),
    ];
    const log: DrawLog = {
      id: `dl_${group.season}_${g.gardenId}_${db.drawLogs.filter((l) => l.gardenId === g.gardenId && l.recruitmentSeason === group.season).length + 1}`,
      gardenId: g.gardenId,
      recruitmentSeason: group.season,
      executedAt: at,
      executedBy: byId,
      applicantCount: g.applicantCount,
      plotCount: rec.plotsOffered,
      seed,
      priorityGroupCount: g.priorityGroupCount,
      note: g.method,
      groupId,
      status: '미확정',
      resultSnapshot: rows,
    };
    db.drawLogs.push(log);
  }
  return ok(seed);
}

/** 미확정 추첨을 폐기한다. 사유가 필수이고, 폐기 기록도 감사 로그에 남는다. */
export function discardDraw(db: Db, groupId: string, reason: string, byId: string): Res {
  if (!isAdmin(db, byId)) return notAdmin();
  const logs = db.drawLogs.filter((l) => l.groupId === groupId && l.status === '미확정');
  if (logs.length === 0) return fail('폐기할 미확정 추첨이 없습니다.');
  if (!reason.trim()) return fail('폐기 사유를 입력해 주세요. (감사 로그에 남습니다)');
  for (const l of logs) {
    l.status = '폐기';
    l.discardReason = reason.trim();
  }
  return ok(undefined);
}

/** 확정·발표: 결과를 신청·구획·모집 상태에 반영한다. */
export function confirmDraw(db: Db, groupId: string, byId: string): Res<{ won: number; waiting: number; lost: number }> {
  if (!isAdmin(db, byId)) return notAdmin();
  const logs = db.drawLogs.filter((l) => l.groupId === groupId && l.status === '미확정');
  if (logs.length === 0) return fail('확정할 미확정 추첨이 없습니다.');

  // 신청별 결과 모으기
  type Per = { win?: { gardenId: string }; waits: { gardenId: string; no: number }[] };
  const per = new Map<string, Per>();
  for (const l of logs) {
    for (const row of l.resultSnapshot) {
      const p = per.get(row.applicationId) ?? { waits: [] };
      if (row.result === '당첨') p.win = { gardenId: l.gardenId };
      if (row.result === '대기' && row.waitlistNo) p.waits.push({ gardenId: l.gardenId, no: row.waitlistNo });
      per.set(row.applicationId, p);
    }
  }
  // 구획이 충분한지 먼저 확인 (부족하면 아무것도 바꾸지 않는다)
  const winsByGarden = new Map<string, string[]>();
  for (const [appId, p] of per) if (p.win) winsByGarden.set(p.win.gardenId, [...(winsByGarden.get(p.win.gardenId) ?? []), appId]);
  for (const [gid, ids] of winsByGarden) {
    const vacant = db.plots.filter((p) => p.gardenId === gid && p.status === '공실').length;
    if (vacant < ids.length) return fail(`빈 구획이 부족해요. (${db.gardens.find((g) => g.id === gid)?.name}: 필요 ${ids.length}개, 빈 구획 ${vacant}개)`);
  }

  const counts = { won: 0, waiting: 0, lost: 0 };
  for (const [appId, p] of per) {
    const app = db.applications.find((a) => a.id === appId);
    if (!app) continue;
    if (p.win) {
      const gid = p.win.gardenId;
      const plot = db.plots.filter((x) => x.gardenId === gid && x.status === '공실').sort((a, b) => a.number - b.number)[0];
      plot.status = '배정';
      plot.userId = app.userId;
      const rec = db.recruitments.find((r) => r.gardenId === gid && `${r.year}-${r.season}` === app.recruitmentSeason);
      app.status = '당첨';
      app.assignedGardenId = gid;
      app.waitlist = [];
      app.waitlistNo = null;
      app.acceptDeadlineAt = addDays(db.meta.today, rec?.acceptDeadlineDays ?? db.settings.acceptDeadlineDays);
      counts.won++;
    } else if (p.waits.length > 0) {
      app.waitlist = p.waits.sort((a, b) => app.choices.indexOf(a.gardenId) - app.choices.indexOf(b.gardenId));
      app.waitlistNo = app.waitlist[0].no;
      app.status = '대기';
      app.assignedGardenId = null;
      counts.waiting++;
    } else {
      app.status = '낙첨';
      app.waitlist = [];
      app.waitlistNo = null;
      app.assignedGardenId = null;
      counts.lost++;
    }
  }
  const gardenIds = new Set(logs.map((l) => l.gardenId));
  const season = logs[0].recruitmentSeason;
  for (const r of db.recruitments) if (gardenIds.has(r.gardenId) && `${r.year}-${r.season}` === season) r.status = '추첨완료';
  const confirmedAt = `${db.meta.today}T${logs[0].executedAt.slice(11)}`;
  for (const l of logs) {
    l.status = '확정';
    l.confirmedAt = confirmedAt;
  }
  db.notifications.push({
    id: `nt_draw_${db.notifications.length + 1}`,
    channel: '앱 알림',
    recipientCount: per.size,
    message: `${[...gardenIds].map((g) => db.gardens.find((x) => x.id === g)?.name).join(', ')} 추첨 결과가 발표되었습니다.`,
    sentAt: confirmedAt,
  });
  return ok(counts);
}

// ───────── 수락 · 포기 · 승계 ─────────

const offerPlot = (db: Db, a: Application) => db.plots.find((p) => p.gardenId === a.assignedGardenId && p.userId === a.userId && p.status === '배정');

export function acceptOffer(db: Db, applicationId: string, userId: string): Res {
  const a = db.applications.find((x) => x.id === applicationId);
  if (!a || a.userId !== userId) return fail('신청을 찾을 수 없습니다.');
  if (a.status !== '당첨') return fail('당첨 상태의 신청만 수락할 수 있어요.');
  if (a.acceptDeadlineAt && a.acceptDeadlineAt < db.meta.today) return fail('수락 기한이 지났어요.');
  const plot = offerPlot(db, a);
  if (!plot) return fail('배정된 구획을 찾을 수 없어요. 담당 부서에 문의해 주세요.');
  a.status = '수락';
  a.acceptDeadlineAt = undefined;
  plot.status = '이용중';
  plot.usageStart = db.meta.today;
  plot.usageEnd = usageEndOf(db.meta.today, db.settings.usageTermMonths);
  return ok(undefined);
}

export function declineOffer(db: Db, applicationId: string, userId: string): Res<{ promotedTo: string | null }> {
  const a = db.applications.find((x) => x.id === applicationId);
  if (!a || a.userId !== userId) return fail('신청을 찾을 수 없습니다.');
  if (a.status !== '당첨') return fail('당첨 상태의 신청만 포기할 수 있어요.');
  const plot = offerPlot(db, a);
  a.status = '포기';
  a.acceptDeadlineAt = undefined;
  const promoted = plot ? releasePlot(db, plot.id, a.userId, '포기') : null;
  return ok({ promotedTo: promoted });
}

/**
 * 구획을 비우고 대기자에게 승계한다. 대기번호가 가장 빠른 사람이 같은 수락 기한으로 당첨된다.
 * 대기자가 없으면 구획은 공실로 남고 "재모집 필요"로 기록한다. (포기·기한 경과·회수 공통)
 * 반환값: 승계받은 신청 id 또는 null
 */
export function releasePlot(db: Db, plotId: string, fromUserId: string, reason: '포기' | '기한 경과' | '회수'): string | null {
  const plot = db.plots.find((p) => p.id === plotId)!;
  plot.status = '공실';
  plot.userId = null;
  // 새 이용자는 경고 0회로 시작한다. (이전 이용자의 경고 기록은 db.warnings에 그대로 남는다)
  plot.warningCount = 0;
  plot.usageStart = undefined;
  plot.usageEnd = undefined;

  const next = db.applications
    .filter((a) => a.status === '대기' && a.waitlist?.some((w) => w.gardenId === plot.gardenId))
    .map((a) => ({ a, no: a.waitlist!.find((w) => w.gardenId === plot.gardenId)!.no }))
    .sort((x, y) => x.no - y.no || x.a.id.localeCompare(y.a.id))[0];

  const seq = db.successions.length + 1;
  if (!next) {
    db.successions.push({ id: `sc_${seq}`, at: db.meta.today, gardenId: plot.gardenId, plotId, reason, fromUserId, toApplicationId: null, toUserId: null, note: '대기자 없음 — 재모집이 필요합니다' });
    return null;
  }
  const rec = db.recruitments.find((r) => r.gardenId === plot.gardenId && `${r.year}-${r.season}` === next.a.recruitmentSeason);
  next.a.status = '당첨';
  next.a.assignedGardenId = plot.gardenId;
  next.a.waitlist = [];
  next.a.waitlistNo = null;
  next.a.acceptDeadlineAt = addDays(db.meta.today, rec?.acceptDeadlineDays ?? db.settings.acceptDeadlineDays);
  plot.status = '배정';
  plot.userId = next.a.userId;
  db.successions.push({ id: `sc_${seq}`, at: db.meta.today, gardenId: plot.gardenId, plotId, reason, fromUserId, toApplicationId: next.a.id, toUserId: next.a.userId, note: `대기 ${next.no}번` });
  return next.a.id;
}

export interface ExpireSummary {
  expired: number;
  promoted: number;
  unfilled: number;
}

/** 수락 기한이 지난 당첨을 자동 포기 처리하고 대기 1번에게 승계한다. */
export function expireOffers(db: Db): ExpireSummary {
  const s: ExpireSummary = { expired: 0, promoted: 0, unfilled: 0 };
  const overdue = db.applications.filter((a) => a.status === '당첨' && a.acceptDeadlineAt && a.acceptDeadlineAt < db.meta.today);
  for (const a of overdue) {
    const plot = offerPlot(db, a);
    a.status = '포기';
    a.acceptDeadlineAt = undefined;
    s.expired++;
    if (plot) {
      if (releasePlot(db, plot.id, a.userId, '기한 경과')) s.promoted++;
      else s.unfilled++;
    }
  }
  return s;
}

export interface AdvanceSummary extends ExpireSummary {
  today: string;
  opened: number;
  closed: number;
}

/**
 * (시연용) 기준일을 앞으로 돌린다. 날짜가 지난 모집은 자동으로 시작·마감하고, 수락 기한이 지난 당첨은 자동 포기·승계한다.
 * 실서비스에서는 같은 일을 매일 밤 정해진 시각에 도는 작업이 한다.
 */
export function advanceDays(db: Db, days: number, byId: string): Res<AdvanceSummary> {
  if (!isAdmin(db, byId)) return notAdmin();
  if (!Number.isInteger(days) || days < 1 || days > 90) return fail('1~90일 사이로 입력해 주세요.');
  db.meta.today = addDays(db.meta.today, days);
  let opened = 0;
  let closed = 0;
  for (const r of db.recruitments) {
    if (r.status === '준비' && r.applyStart <= db.meta.today) {
      r.status = '모집중';
      opened++;
    }
    if (r.status === '모집중' && r.applyEnd < db.meta.today) {
      r.status = '마감';
      closed++;
    }
  }
  return ok({ ...expireOffers(db), today: db.meta.today, opened, closed });
}

/** 시즌 키 헬퍼 (화면용) */
export const seasonLabel = (s: SeasonKey) => s.replace('-', ' ');

export type { WinGroup };
