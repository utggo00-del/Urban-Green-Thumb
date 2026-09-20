// 미경작 경고와 회수 (SPEC 5.4). 순수 함수 — 넘겨받은 Db를 직접 고치고, 검증에 실패하면 아무것도 바꾸지 않는다.
//
//  · 관리자가 미경작 점검 결과로 경고를 줄 때마다 그 구획의 경고가 1씩 는다. (사유 필수)
//  · 1~2회: 시민 화면에 경고 배너와 사유. 3회(설정값)에 도달하면 구획이 “회수대기”가 되어 관리자에게 회수 확정 버튼이 나온다.
//  · 회수 확정: 구획은 공실로 돌아가고 대기자가 있으면 승계한다. 대기자가 없으면 재모집 필요로 기록한다.
//  · 경고는 “이용자 + 구획” 단위로 센다. 구획이 다른 사람에게 넘어가면 새 이용자는 0회로 시작한다.
import type { Db, Plot, Warning } from '../types';
import { releasePlot } from './allocation';
import { formatDate } from './date';
import { fail, ok, type Res } from './workflow';

const isAdmin = (db: Db, id: string) => db.users.find((u) => u.id === id)?.role === '관리자';
const notAdmin = () => fail('텃밭지원과 관리자만 할 수 있는 작업입니다.');

export const WARNING_SOURCES = ['현장 점검', '시민 신고 확인', '이용자 미응답'] as const;
export type WarningSource = (typeof WARNING_SOURCES)[number];

/** 이 구획에서 현재 이용자가 받은 경고 기록 (오래된 순) */
export const warningsOf = (db: Db, plotId: string, userId: string | null): Warning[] =>
  db.warnings.filter((w) => w.plotId === plotId && w.userId === userId).sort((a, b) => a.issuedAt.localeCompare(b.issuedAt) || a.id.localeCompare(b.id));

/** 사유 끝에 점검일이 이미 적혀 있으면 날짜를 따로 보여주지 않아도 된다 (예: “… (현장 점검 2026.06.18)”) */
export const reasonHasDate = (w: Pick<Warning, 'reason' | 'issuedAt'>): boolean => w.reason.includes(formatDate(w.issuedAt));

export type WarningLevel = 'none' | 'notice' | 'danger' | 'recall';

/** 경고 횟수에 따른 단계: 0회 / 1회 안내 / 회수 직전 / 회수 대상 */
export function warningLevel(count: number, limit: number): WarningLevel {
  if (count <= 0) return 'none';
  if (count >= limit) return 'recall';
  return count === limit - 1 ? 'danger' : 'notice';
}

/** 시민이 이용 중인 구획 (배정만 되고 수락 전인 구획은 제외) */
export const usedPlots = (db: Db, userId: string): Plot[] =>
  db.plots.filter((p) => p.userId === userId && (p.status === '이용중' || p.status === '회수대기')).sort((a, b) => a.gardenId.localeCompare(b.gardenId) || a.number - b.number);

export const recallPendingPlots = (db: Db): Plot[] => db.plots.filter((p) => p.status === '회수대기');

export interface IssueInput {
  plotId: string;
  /** 경고 사유 (필수) */
  reason: string;
  source?: WarningSource;
  /** 점검(확인)일 YYYY-MM-DD. 비우면 오늘 */
  inspectedAt?: string;
}

export interface IssueResult {
  count: number;
  /** 이번 경고로 회수 대상이 되었는지 */
  recallPending: boolean;
}

/** 경고 부여. 사유가 없으면 부여할 수 없다. */
export function issueWarning(db: Db, input: IssueInput, byId: string): Res<IssueResult> {
  if (!isAdmin(db, byId)) return notAdmin();
  const plot = db.plots.find((p) => p.id === input.plotId);
  if (!plot) return fail('구획을 찾을 수 없습니다.');
  const reason = input.reason.trim();
  if (!reason) return fail('경고 사유를 입력해 주세요. (사유가 없으면 경고를 줄 수 없어요)');
  if (plot.status === '회수대기') return fail('이미 회수 대상인 구획입니다. 회수 확정을 진행해 주세요.');
  if (plot.status !== '이용중' || !plot.userId) return fail('이용 중인 구획에만 경고를 줄 수 있어요.');
  const at = input.inspectedAt || db.meta.today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(at)) return fail('점검일을 입력해 주세요.');
  if (at > db.meta.today) return fail('점검일은 오늘 이후일 수 없어요.');

  const source = input.source ?? '현장 점검';
  db.warnings.push({
    id: `w_${plot.id}_${plot.userId}_${warningsOf(db, plot.id, plot.userId).length + 1}`,
    plotId: plot.id,
    userId: plot.userId,
    reason: `${reason} (${source} ${formatDate(at)})`,
    issuedAt: at,
    issuedBy: byId,
  });
  const count = warningsOf(db, plot.id, plot.userId).length;
  plot.warningCount = count;
  const recallPending = count >= db.settings.warningLimit;
  if (recallPending) plot.status = '회수대기';

  const garden = db.gardens.find((g) => g.id === plot.gardenId);
  db.notifications.push({
    id: `nt_warn_${db.notifications.length + 1}`,
    channel: '앱 알림',
    recipientCount: 1,
    message: recallPending
      ? `${garden?.name} ${plot.number}번 구획 경고 ${count}회 누적 — 회수 대상이 되었습니다.`
      : `${garden?.name} ${plot.number}번 구획 미경작 경고 ${count}회 (${db.settings.warningLimit}회 누적 시 회수)`,
    sentAt: `${db.meta.today}T09:00`,
  });
  return ok({ count, recallPending });
}

export interface RecallResult {
  userId: string;
  /** 승계받은 신청 id. 대기자가 없으면 null(재모집 필요) */
  promotedTo: string | null;
}

/** 회수 확정: 구획을 공실로 돌리고 대기자에게 승계한다. */
export function confirmRecall(db: Db, plotId: string, byId: string): Res<RecallResult> {
  if (!isAdmin(db, byId)) return notAdmin();
  const plot = db.plots.find((p) => p.id === plotId);
  if (!plot) return fail('구획을 찾을 수 없습니다.');
  if (plot.status !== '회수대기' || !plot.userId) return fail('회수 대상(회수대기)인 구획만 회수를 확정할 수 있어요.');
  const userId = plot.userId;
  const garden = db.gardens.find((g) => g.id === plot.gardenId);
  const promotedTo = releasePlot(db, plot.id, userId, '회수');
  db.notifications.push({
    id: `nt_recall_${db.notifications.length + 1}`,
    channel: '앱 알림',
    recipientCount: 1,
    message: `${garden?.name} ${plot.number}번 구획이 경고 ${db.settings.warningLimit}회 누적으로 회수되었습니다.`,
    sentAt: `${db.meta.today}T09:00`,
  });
  return ok({ userId, promotedTo });
}
