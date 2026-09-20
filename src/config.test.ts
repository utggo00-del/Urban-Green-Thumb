import { describe, expect, it } from 'vitest';
import { DEFAULT_POLICY, DEMO_CITIZEN_ACCOUNTS, DEMO_GUIDE_EXTRAS, DEMO_GUIDE_STEPS, DEMO_ROLES, DEMO_ROLE_ORDER, DEMO_TODAY, DEPARTMENT, SERVICE_NAME } from './config';
import { buildSeed } from './data/seed';

const db = buildSeed();

describe('시연 설정이 시드 데이터와 어긋나지 않는다', () => {
  it('시연 계정은 모두 실제 사용자이고 시민이다', () => {
    for (const a of DEMO_CITIZEN_ACCOUNTS) {
      const u = db.users.find((x) => x.id === a.userId);
      expect(u, a.userId).toBeTruthy();
      expect(u?.role).toBe('시민');
      expect(a.hint.length).toBeGreaterThan(0);
    }
    expect(DEMO_CITIZEN_ACCOUNTS[0].userId).toBe(DEMO_ROLES.citizen.defaultUserId);
  });

  it('시연 계정의 힌트가 실제 상태와 맞다', () => {
    const app = (id: string) => db.applications.find((a) => a.userId === id && a.recruitmentSeason === '2026-가을');
    expect(app('u_c001')).toBeUndefined(); // 처음부터 신청해 볼 수 있는 계정
    expect(app('u_c002')).toBeUndefined();
    expect(db.users.find((u) => u.id === 'u_c003')?.isSiheungResident).toBe(false); // 타 지역
    expect(app('u_a001')?.status).toBe('추첨대기');
    expect(app('u_a014')?.choices).toHaveLength(3); // 3지망
    const s001 = db.plots.find((p) => p.userId === 'u_s001')!;
    expect(s001.warningCount).toBe(db.settings.warningLimit - 1); // 경고 2회(회수 직전)
    expect(db.gardens.find((g) => g.id === s001.gardenId)?.type).toBe('민간');
    const s017 = db.plots.find((p) => p.userId === 'u_s017')!;
    expect(s017.warningCount).toBe(1);
    expect(db.gardens.find((g) => g.id === s017.gardenId)?.type).toBe('공공');
  });

  it('역할 기본 계정이 존재하고 역할과 맞는다', () => {
    const want = { citizen: '시민', provider: '제공자', admin: '관리자', member: '심의위원' } as const;
    for (const r of DEMO_ROLE_ORDER) {
      const u = db.users.find((x) => x.id === DEMO_ROLES[r].defaultUserId);
      expect(u?.role, r).toBe(want[r]);
    }
    expect(db.users.find((u) => u.id === DEMO_ROLES.admin.defaultUserId)?.isCommitteeSecretary).toBe(true);
  });

  it('시연 가이드: 5단계, 각 단계에 역할·경로·확인 항목이 있다', () => {
    expect(DEMO_GUIDE_STEPS).toHaveLength(5);
    for (const s of [...DEMO_GUIDE_STEPS, ...DEMO_GUIDE_EXTRAS]) {
      expect(DEMO_ROLE_ORDER).toContain(s.role);
      expect(s.path.startsWith('/')).toBe(true);
      expect(s.title.length).toBeGreaterThan(5);
    }
    for (const s of DEMO_GUIDE_STEPS) expect(s.checks.length).toBeGreaterThanOrEqual(2);
    // 관리자 경로는 관리자 역할, 심의위원 경로는 심의위원 역할로만 열린다
    for (const s of [...DEMO_GUIDE_STEPS, ...DEMO_GUIDE_EXTRAS]) {
      if (s.path.startsWith('/admin')) expect(s.role).toBe('admin');
      if (s.path.startsWith('/committee')) expect(s.role).toBe('member');
    }
    expect(DEMO_GUIDE_STEPS.map((s) => s.path)).toEqual(['/gardens', '/register/new', '/admin/review', '/admin/draw', '/admin/warnings']);
  });
});

describe('정책 기본값은 SPEC 12장의 가정값', () => {
  it('설정값', () => {
    expect(DEFAULT_POLICY).toMatchObject({
      residentOnly: true, maxChoices: 3, priorityQuotaRatio: 0.3, acceptDeadlineDays: 5, warningLimit: 3,
      seasonWindows: { 봄: { startMonth: 2, endMonth: 3 }, 가을: { startMonth: 8, endMonth: 9 } },
    });
    expect(db.settings).toEqual(DEFAULT_POLICY);
  });
  it('앱 이름은 “참도시농부(시흥시 텃밭 분양 서비스)”', () => {
    expect(SERVICE_NAME).toBe('참도시농부(시흥시 텃밭 분양 서비스)');
  });
  it('부서명 “텃밭지원과(가칭)”은 그대로 쓴다, 시연 기준일', () => {
    expect(DEPARTMENT).toBe('텃밭지원과(가칭)');
    expect(DEMO_TODAY).toBe('2026-09-20');
  });
});
