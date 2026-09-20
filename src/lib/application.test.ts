import { describe, expect, it } from 'vitest';
import { buildSeed } from '../data/seed';
import type { Application, Db } from '../types';
import {
  applicableGardenIds,
  buildApplication,
  canCancel,
  eligibilityBlock,
  existingApplication,
  flowIndex,
  gardenApplyBlock,
  proxyApply,
  type ApplicationInput,
  type NewApplicant,
  type ProxyInput,
} from './application';

const input = (over: Partial<ApplicationInput> = {}): ApplicationInput => ({
  userId: 'u_c001',
  choices: ['g01', 'g02', 'g07'],
  priorityType: '없음',
  agreePrivacy: true,
  agreeRules: true,
  ...over,
});

describe('신청 자격 (SPEC 5.1)', () => {
  const db = buildSeed();

  it('시흥시민만 신청 가능', () => {
    expect(eligibilityBlock(db, db.users.find((u) => u.id === 'u_c001')!)).toBeNull();
    expect(eligibilityBlock(db, db.users.find((u) => u.id === 'u_c003')!)).toBe('시흥시민만 신청할 수 있습니다.');
    const r = buildApplication(db, input({ userId: 'u_c003' }));
    expect(r).toEqual({ ok: false, error: '시흥시민만 신청할 수 있습니다.' });
  });

  it('시민 한정은 설정값이다 (끄면 타 지역도 신청 가능)', () => {
    const d = structuredClone(db);
    d.settings.residentOnly = false;
    expect(buildApplication(d, input({ userId: 'u_c003' })).ok).toBe(true);
  });

  it('한 시즌에 1인 1건: 이미 신청한 사용자는 막힌다', () => {
    expect(existingApplication(db, 'u_a001')).toBeTruthy();
    const r = buildApplication(db, input({ userId: 'u_a001' }));
    expect(r.ok).toBe(false);
    expect(existingApplication(db, 'u_c001')).toBeUndefined();
  });

  it('신청을 취소하면 다시 신청할 수 있다', () => {
    const d = structuredClone(db);
    d.applications.find((a) => a.userId === 'u_a001' && a.recruitmentSeason === '2026-가을')!.status = '취소';
    const r = buildApplication(d, input({ userId: 'u_a001' }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.application.id).toBe('app_2026-가을_u_a001_2'); // 취소 건과 id가 겹치지 않는다
  });
});

describe('지망 검증', () => {
  const db = buildSeed();

  it('정상 신청은 접수 상태로 만들어진다 (3곳 지망, 우선 배정 자기신고는 미확인)', () => {
    const r = buildApplication(db, input({ priorityType: '다자녀' }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.application).toMatchObject({
      status: '접수', choices: ['g01', 'g02', 'g07'], priorityType: '다자녀', priorityVerified: false,
      residenceVerified: true, appliedBy: '본인', assignedGardenId: null, waitlistNo: null, consentAt: '2026-09-20',
    });
  });

  it('지망은 1~3곳, 중복 불가', () => {
    expect(buildApplication(db, input({ choices: [] })).ok).toBe(false);
    expect(buildApplication(db, input({ choices: ['g01', 'g02', 'g07', 'g08'] })).ok).toBe(false);
    expect(buildApplication(db, input({ choices: ['g01', 'g01'] })).ok).toBe(false);
    expect(buildApplication(db, input({ choices: ['g01'] })).ok).toBe(true);
  });

  it('최대 지망 수는 설정값을 따른다', () => {
    const d = structuredClone(db);
    d.settings.maxChoices = 2;
    expect(buildApplication(d, input()).ok).toBe(false);
    expect(buildApplication(d, input({ choices: ['g01', 'g02'] })).ok).toBe(true);
  });

  it('심의를 거치지 않은 텃밭·모집 중이 아닌 텃밭은 고를 수 없다', () => {
    expect(gardenApplyBlock(db, 'g13')).toContain('지정'); // 심의대기
    expect(gardenApplyBlock(db, 'g15')).toContain('지정'); // 보류
    expect(gardenApplyBlock(db, 'g16')).toContain('지정'); // 검수중
    expect(gardenApplyBlock(db, 'g06')).toBe('모집이 마감되었습니다.');
    expect(gardenApplyBlock(db, 'g05')).toBe('아직 모집 기간이 시작되지 않았습니다.');
    expect(gardenApplyBlock(db, 'g09')).toBe('이번 시즌에는 모집하지 않는 텃밭입니다.');
    expect(gardenApplyBlock(db, 'g01')).toBeNull();
    expect(buildApplication(db, input({ choices: ['g01', 'g13'] })).ok).toBe(false);
    expect(buildApplication(db, input({ choices: ['g06'] })).ok).toBe(false);
  });

  it('신청 가능한 텃밭은 모집 중인 지정 텃밭 8곳', () => {
    expect(applicableGardenIds(db).sort()).toEqual(['g01', 'g02', 'g04', 'g07', 'g08', 'g10', 'g11', 'g12']);
  });

  it('개인정보·이용 규칙 동의가 없으면 신청할 수 없다', () => {
    expect(buildApplication(db, input({ agreePrivacy: false })).ok).toBe(false);
    expect(buildApplication(db, input({ agreeRules: false })).ok).toBe(false);
  });
});

describe('신청 흐름 단계', () => {
  const db: Db = buildSeed();
  const app = (status: Application['status']) => ({ ...db.applications[0], status });

  it('신청완료 → 추첨대기 → 결과 → 수락 → 이용중', () => {
    expect(flowIndex(db, app('접수'))).toBe(0);
    expect(flowIndex(db, app('추첨대기'))).toBe(1);
    for (const s of ['당첨', '대기', '낙첨'] as const) expect(flowIndex(db, app(s))).toBe(2);
    expect(flowIndex(db, app('포기'))).toBeNull();
    expect(flowIndex(db, app('취소'))).toBeNull();
  });

  it('수락 후 구획을 이용 중이면 이용중 단계', () => {
    const spring = db.applications.find((a) => a.recruitmentSeason === '2026-봄' && a.status === '수락')!;
    expect(flowIndex(db, spring)).toBe(4);
    const noPlot = { ...spring, userId: 'u_c001' };
    expect(flowIndex(db, noPlot)).toBe(3);
  });

  it('추첨 전이고 모집이 마감되기 전에만 취소할 수 있다', () => {
    const open = { ...db.applications.find((a) => a.choices.every((c) => ['g01', 'g02', 'g07', 'g08'].includes(c)))! };
    expect(canCancel(db, { ...open, status: '접수' })).toBe(true);
    expect(canCancel(db, { ...open, status: '추첨대기' })).toBe(true);
    expect(canCancel(db, { ...open, status: '당첨' })).toBe(false);
    // 지망한 텃밭(g06)의 모집이 마감되면 취소할 수 없다
    expect(canCancel(db, { ...app('접수'), choices: ['g06'] })).toBe(false);
    expect(canCancel(db, { ...app('접수'), choices: ['g01', 'g06'] })).toBe(false);
  });
});

describe('관리자 대리 신청 (SPEC 3.2-10)', () => {
  const ADMIN = 'u_admin1';
  const base = (over: Partial<ProxyInput> = {}): ProxyInput => ({
    userId: 'u_s005', choices: ['g01', 'g02'], priorityType: '노인', priorityVerified: true, consentConfirmed: true, channel: '방문', ...over,
  });
  const fresh = () => buildSeed();
  const value = <T,>(r: { ok: boolean; value?: T; error?: string }): T => {
    expect(r.ok, r.error).toBe(true);
    return r.value as T;
  };

  it('기존 시민을 대신해 신청하면 관리자 대리 신청으로 접수된다 (접수 방식·증빙 확인 상태 기록)', () => {
    const d = fresh();
    const r = value(proxyApply(d, base(), ADMIN));
    expect(r).toMatchObject({ userId: 'u_s005', created: false });
    expect(d.applications.find((a) => a.id === r.applicationId)).toMatchObject({
      appliedBy: '관리자대리', proxyChannel: '방문', status: '접수', choices: ['g01', 'g02'], priorityType: '노인', priorityVerified: true, consentAt: '2026-09-20',
    });
  });

  it('증빙을 확인하지 않았거나 우선 배정이 없으면 확인 상태가 아니다', () => {
    const d = fresh();
    const a = value(proxyApply(d, base({ priorityVerified: false }), ADMIN));
    expect(d.applications.find((x) => x.id === a.applicationId)?.priorityVerified).toBe(false);
    const b = value(proxyApply(d, base({ userId: 'u_s006', priorityType: '없음', priorityVerified: true }), ADMIN));
    expect(d.applications.find((x) => x.id === b.applicationId)?.priorityVerified).toBe(false);
  });

  it('시스템에 없는 신청자는 새로 등록하면서 신청한다', () => {
    const d = fresh();
    const users = d.users.length;
    const r = value(proxyApply(d, base({ userId: undefined, newApplicant: { name: '김할머니', phone: '010-1234-5678', dong: '정왕동', isSiheungResident: true } }), ADMIN));
    expect(r.created).toBe(true);
    expect(d.users).toHaveLength(users + 1);
    expect(d.users.find((u) => u.id === r.userId)).toMatchObject({ name: '김할머니', role: '시민', isSiheungResident: true, priorityTypes: ['노인'], phone: '010-1234-5678' });
    expect(d.applications.find((a) => a.id === r.applicationId)?.appliedBy).toBe('관리자대리');
  });

  it('신청이 실패하면 새 신청자도 만들어지지 않는다 (타 지역 거주 · 중복 지망)', () => {
    const d = fresh();
    const before = JSON.stringify(d);
    const out = proxyApply(d, base({ userId: undefined, newApplicant: { name: '박타지', phone: '010-9999-8888', dong: '안산시', isSiheungResident: false } }), ADMIN);
    expect(out).toEqual({ ok: false, error: '시흥시민만 신청할 수 있습니다.' });
    expect(proxyApply(d, base({ userId: undefined, newApplicant: { name: '이시흥', phone: '010-1111-2222', dong: '정왕동', isSiheungResident: true }, choices: ['g01', 'g01'] }), ADMIN).ok).toBe(false);
    expect(JSON.stringify(d)).toBe(before);
  });

  it('본인 신청과 같은 규칙: 1인 1건, 모집 중인 지정 텃밭만', () => {
    const d = fresh();
    value(proxyApply(d, base(), ADMIN));
    expect(proxyApply(d, base(), ADMIN)).toMatchObject({ ok: false }); // 같은 사람 두 번째
    expect(proxyApply(d, base({ userId: 'u_s007', choices: ['g06'] }), ADMIN)).toMatchObject({ ok: false }); // 마감 텃밭
    expect(proxyApply(d, base({ userId: 'u_s007', choices: ['g13'] }), ADMIN)).toMatchObject({ ok: false }); // 심의대기 텃밭
    expect(proxyApply(d, base({ userId: 'u_s007', choices: [] }), ADMIN)).toMatchObject({ ok: false });
  });

  it('본인 동의를 확인하지 않으면 입력할 수 없다', () => {
    const d = fresh();
    const r = proxyApply(d, base({ consentConfirmed: false }), ADMIN);
    expect(r.ok).toBe(false);
    expect((r as { error: string }).error).toContain('동의');
  });

  it('새 신청자 입력 검증: 이름·연락처·행정동', () => {
    const d = fresh();
    const mk = (n: Partial<NewApplicant>) => base({ userId: undefined, newApplicant: { name: '홍할배', phone: '010-1234-5678', dong: '정왕동', isSiheungResident: true, ...n } });
    expect((proxyApply(d, mk({ name: '가' }), ADMIN) as { error: string }).error).toContain('이름');
    expect((proxyApply(d, mk({ phone: '12345' }), ADMIN) as { error: string }).error).toContain('연락처');
    expect((proxyApply(d, mk({ dong: ' ' }), ADMIN) as { error: string }).error).toContain('행정동');
    expect((proxyApply(d, base({ userId: undefined }), ADMIN) as { error: string }).error).toContain('신청자');
    expect(proxyApply(d, mk({ phone: '01012345678' }), ADMIN).ok).toBe(true); // 하이픈 없이도 가능
  });

  it('관리자만 대리 신청할 수 있다 (시민·심의위원 불가)', () => {
    const d = fresh();
    expect((proxyApply(d, base(), 'u_c001') as { error: string }).error).toContain('관리자');
    expect((proxyApply(d, base(), 'u_member05') as { error: string }).error).toContain('관리자');
  });

  it('새 신청자 id는 겹치지 않는다', () => {
    const d = fresh();
    const a = value(proxyApply(d, base({ userId: undefined, newApplicant: { name: '첫째분', phone: '010-1000-2000', dong: '정왕동', isSiheungResident: true } }), ADMIN));
    const b = value(proxyApply(d, base({ userId: undefined, newApplicant: { name: '둘째분', phone: '010-3000-4000', dong: '정왕동', isSiheungResident: true } }), ADMIN));
    expect(a.userId).not.toBe(b.userId);
  });
});
