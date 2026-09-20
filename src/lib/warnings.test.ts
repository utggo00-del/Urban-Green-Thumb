import { beforeEach, describe, expect, it } from 'vitest';
import { buildSeed } from '../data/seed';
import type { Db } from '../types';
import { acceptOffer, confirmDraw, runDraw } from './allocation';
import { drawGroups } from './recruitment';
import { confirmRecall, issueWarning, recallPendingPlots, usedPlots, warningLevel, warningsOf } from './warnings';
import type { Res } from './workflow';

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

const plot = (id: string) => db.plots.find((p) => p.id === id)!;
// 시드: u_s001은 g06_01에서 경고 2회(회수 직전), u_s002는 g06_02에서 1회, u_s003은 g06_03에서 0회
const P2 = 'g06_01';
const P1 = 'g06_02';
const P0 = 'g06_03';

describe('경고 단계', () => {
  it('횟수에 따라 없음·안내·회수 직전·회수 대상', () => {
    expect(warningLevel(0, 3)).toBe('none');
    expect(warningLevel(1, 3)).toBe('notice');
    expect(warningLevel(2, 3)).toBe('danger');
    expect(warningLevel(3, 3)).toBe('recall');
    expect(warningLevel(4, 3)).toBe('recall');
  });
  it('회수 기준은 설정값을 따른다 (기준 2회면 1회가 회수 직전, 2회가 회수 대상)', () => {
    expect(warningLevel(1, 2)).toBe('danger');
    expect(warningLevel(2, 2)).toBe('recall');
  });
});

describe('경고 부여', () => {
  it('시드: 경고 1·2회 이용자가 있고, 구획의 경고 횟수는 기록과 같다', () => {
    expect(plot(P2).warningCount).toBe(2);
    expect(plot(P1).warningCount).toBe(1);
    expect(plot(P0).warningCount).toBe(0);
    expect(warningsOf(db, P2, 'u_s001')).toHaveLength(2);
    expect(recallPendingPlots(db)).toHaveLength(0);
  });

  it('첫 경고: 횟수가 1이 되고 구획은 이용중 그대로, 사유·점검 경로·일자가 남는다', () => {
    const r = okValue(issueWarning(db, { plotId: P0, reason: '잡초가 무성하게 자람', source: '시민 신고 확인', inspectedAt: '2026-09-18' }, ADMIN));
    expect(r).toEqual({ count: 1, recallPending: false });
    expect(plot(P0)).toMatchObject({ warningCount: 1, status: '이용중' });
    const w = warningsOf(db, P0, 'u_s003')[0];
    expect(w).toMatchObject({ plotId: P0, userId: 'u_s003', issuedAt: '2026-09-18', issuedBy: ADMIN });
    expect(w.reason).toBe('잡초가 무성하게 자람 (시민 신고 확인 2026.09.18)');
  });

  it('사유가 없으면 경고를 줄 수 없고 아무것도 바뀌지 않는다', () => {
    const before = JSON.stringify(db);
    expect(errOf(issueWarning(db, { plotId: P0, reason: '' }, ADMIN))).toContain('사유');
    expect(errOf(issueWarning(db, { plotId: P0, reason: '   \n ' }, ADMIN))).toContain('사유');
    expect(JSON.stringify(db)).toBe(before);
  });

  it('점검일은 오늘 이후일 수 없다, 형식도 확인한다', () => {
    expect(errOf(issueWarning(db, { plotId: P0, reason: '사유', inspectedAt: '2026-09-21' }, ADMIN))).toContain('오늘 이후');
    expect(errOf(issueWarning(db, { plotId: P0, reason: '사유', inspectedAt: '9/20' }, ADMIN))).toContain('점검일');
    okValue(issueWarning(db, { plotId: P0, reason: '사유', inspectedAt: '2026-09-20' }, ADMIN)); // 오늘은 가능
  });

  it('이용 중인 구획에만, 관리자만 줄 수 있다', () => {
    expect(errOf(issueWarning(db, { plotId: 'g06_20', reason: '사유' }, ADMIN))).toContain('이용 중');
    expect(errOf(issueWarning(db, { plotId: 'nope', reason: '사유' }, ADMIN))).toContain('찾을 수 없');
    expect(errOf(issueWarning(db, { plotId: P0, reason: '사유' }, 'u_c001'))).toContain('관리자');
    expect(errOf(issueWarning(db, { plotId: P0, reason: '사유' }, 'u_member05'))).toContain('관리자'); // 심의위원 불가
    plot(P0).status = '배정'; // 수락 전 구획
    expect(errOf(issueWarning(db, { plotId: P0, reason: '사유' }, ADMIN))).toContain('이용 중');
  });

  it('경고를 줄 때마다 이용자에게 알림(모의)이 남는다', () => {
    const n = db.notifications.length;
    okValue(issueWarning(db, { plotId: P0, reason: '사유' }, ADMIN));
    expect(db.notifications).toHaveLength(n + 1);
    expect(db.notifications.at(-1)?.message).toContain('경고 1회');
  });
});

describe('3회 누적 → 회수 대상 (SPEC 5.4)', () => {
  it('경고 2회까지는 회수 대상이 아니다', () => {
    okValue(issueWarning(db, { plotId: P0, reason: '1' }, ADMIN));
    const r = okValue(issueWarning(db, { plotId: P0, reason: '2' }, ADMIN));
    expect(r).toEqual({ count: 2, recallPending: false });
    expect(plot(P0).status).toBe('이용중');
    expect(recallPendingPlots(db)).toHaveLength(0);
  });

  it('3번째 경고로 구획이 회수대기가 된다 (회수 직전 이용자 시드)', () => {
    const r = okValue(issueWarning(db, { plotId: P2, reason: '3주 넘게 미경작 상태' }, ADMIN));
    expect(r).toEqual({ count: 3, recallPending: true });
    expect(plot(P2)).toMatchObject({ status: '회수대기', warningCount: 3, userId: 'u_s001' });
    expect(recallPendingPlots(db).map((p) => p.id)).toEqual([P2]);
    expect(db.notifications.at(-1)?.message).toContain('회수 대상');
  });

  it('회수 대상이 된 구획에는 더 이상 경고를 줄 수 없다', () => {
    okValue(issueWarning(db, { plotId: P2, reason: '3' }, ADMIN));
    expect(errOf(issueWarning(db, { plotId: P2, reason: '4' }, ADMIN))).toContain('이미 회수 대상');
    expect(warningsOf(db, P2, 'u_s001')).toHaveLength(3);
  });

  it('회수 기준은 설정값이다 (2회로 낮추면 2번째 경고에 회수 대상)', () => {
    db.settings.warningLimit = 2;
    okValue(issueWarning(db, { plotId: P0, reason: '1' }, ADMIN));
    expect(okValue(issueWarning(db, { plotId: P0, reason: '2' }, ADMIN)).recallPending).toBe(true);
  });

  it('경고는 구획별로 센다: 다른 구획의 경고는 합치지 않는다', () => {
    okValue(issueWarning(db, { plotId: P0, reason: 'a' }, ADMIN));
    okValue(issueWarning(db, { plotId: 'g06_04', reason: 'b' }, ADMIN));
    expect(plot(P0).warningCount).toBe(1);
    expect(plot('g06_04').warningCount).toBe(1);
  });
});

describe('회수 확정 → 구획 반환 · 대기자 승계', () => {
  it('회수 대상이 아닌 구획은 회수할 수 없고, 관리자만 확정한다', () => {
    expect(errOf(confirmRecall(db, P2, ADMIN))).toContain('회수 대상');
    okValue(issueWarning(db, { plotId: P2, reason: '3' }, ADMIN));
    expect(errOf(confirmRecall(db, P2, 'u_c001'))).toContain('관리자');
    expect(errOf(confirmRecall(db, 'nope', ADMIN))).toContain('찾을 수 없');
  });

  it('대기자가 없으면 구획이 공실로 돌아가고 재모집 필요로 기록된다', () => {
    okValue(issueWarning(db, { plotId: P2, reason: '3' }, ADMIN));
    const r = okValue(confirmRecall(db, P2, ADMIN));
    expect(r).toEqual({ userId: 'u_s001', promotedTo: null });
    expect(plot(P2)).toMatchObject({ status: '공실', userId: null, warningCount: 0 });
    expect(db.successions.at(-1)).toMatchObject({ gardenId: 'g06', plotId: P2, reason: '회수', fromUserId: 'u_s001', toApplicationId: null });
    expect(db.successions.at(-1)?.note).toContain('재모집');
    expect(recallPendingPlots(db)).toHaveLength(0);
    expect(db.notifications.at(-1)?.message).toContain('회수되었습니다');
  });

  it('추첨 후에는 대기자에게 승계된다 (시연 5단계: 4단계 추첨 → 경고 → 회수 → 승계)', () => {
    // 4단계: 마감된 묶음 추첨·확정 → 장곡 다솜(g06) 대기자가 생긴다
    for (const g of drawGroups(db).filter((x) => x.state === 'ready')) {
      okValue(runDraw(db, g.id, 20260922, ADMIN));
      okValue(confirmDraw(db, g.id, ADMIN));
    }
    const line = db.applications
      .filter((a) => a.status === '대기' && a.waitlist?.some((w) => w.gardenId === 'g06'))
      .sort((a, b) => a.waitlist!.find((w) => w.gardenId === 'g06')!.no - b.waitlist!.find((w) => w.gardenId === 'g06')!.no);
    expect(line.length).toBeGreaterThan(0);
    const first = line[0];

    // 5단계: 경고 3회째 → 회수 확정 → 대기 1번에게 승계
    okValue(issueWarning(db, { plotId: P2, reason: '지속적인 미경작' }, ADMIN));
    const r = okValue(confirmRecall(db, P2, ADMIN));
    expect(r.promotedTo).toBe(first.id);
    expect(db.applications.find((a) => a.id === first.id)).toMatchObject({ status: '당첨', assignedGardenId: 'g06', acceptDeadlineAt: '2026-09-25' });
    expect(plot(P2)).toMatchObject({ status: '배정', userId: first.userId, warningCount: 0 });
    expect(db.successions.at(-1)).toMatchObject({ reason: '회수', fromUserId: 'u_s001', toApplicationId: first.id });
  });

  it('승계받은 새 이용자는 경고 0회로 시작한다 (이전 이용자의 경고는 기록으로만 남는다)', () => {
    for (const g of drawGroups(db).filter((x) => x.state === 'ready')) {
      okValue(runDraw(db, g.id, 7, ADMIN));
      okValue(confirmDraw(db, g.id, ADMIN));
    }
    okValue(issueWarning(db, { plotId: P2, reason: '3' }, ADMIN));
    const { promotedTo } = okValue(confirmRecall(db, P2, ADMIN));
    const heir = db.applications.find((a) => a.id === promotedTo)!;
    okValue(acceptOffer(db, heir.id, heir.userId));
    expect(plot(P2)).toMatchObject({ status: '이용중', userId: heir.userId, warningCount: 0 });
    expect(warningsOf(db, P2, heir.userId)).toHaveLength(0);
    expect(warningsOf(db, P2, 'u_s001')).toHaveLength(3); // 이전 이용자 기록은 그대로
    // 새 이용자가 첫 경고를 받으면 1회 (이전 경고와 합쳐지지 않는다)
    expect(okValue(issueWarning(db, { plotId: P2, reason: '새 경고' }, ADMIN)).count).toBe(1);
    expect(plot(P2).status).toBe('이용중');
  });
});

describe('내 텃밭 조회', () => {
  it('이용중·회수대기 구획만 내 텃밭에 나온다 (수락 전 배정 구획은 제외)', () => {
    expect(usedPlots(db, 'u_s001').map((p) => p.id)).toEqual([P2]);
    okValue(issueWarning(db, { plotId: P2, reason: '3' }, ADMIN));
    expect(usedPlots(db, 'u_s001').map((p) => p.status)).toEqual(['회수대기']);
    okValue(confirmRecall(db, P2, ADMIN));
    expect(usedPlots(db, 'u_s001')).toHaveLength(0);
    plot('g06_10').userId = 'u_c001';
    plot('g06_10').status = '배정';
    expect(usedPlots(db, 'u_c001')).toHaveLength(0);
  });

  it('시드의 이용 기간: 봄 이용자는 2026.04.01 ~ 2026.11.30', () => {
    expect(plot(P2)).toMatchObject({ usageStart: '2026-04-01', usageEnd: '2026-11-30' });
    expect(plot('g06_20').usageStart).toBeUndefined();
  });

  it('수락하면 수락일부터 이용 기간(8개월)이 시작된다', () => {
    for (const g of drawGroups(db).filter((x) => x.state === 'ready')) {
      okValue(runDraw(db, g.id, 7, ADMIN));
      okValue(confirmDraw(db, g.id, ADMIN));
    }
    const w = db.applications.find((a) => a.status === '당첨')!;
    okValue(acceptOffer(db, w.id, w.userId));
    const p = db.plots.find((x) => x.userId === w.userId && x.gardenId === w.assignedGardenId)!;
    expect(p).toMatchObject({ status: '이용중', usageStart: '2026-09-20', usageEnd: '2027-05-19' });
  });
});
