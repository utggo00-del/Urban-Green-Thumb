// 분양 신청 자격·검증·생성 (SPEC 5.1). 순수 함수 — 저장은 data/actions.ts가 한다.
import { currentSeasonKey, getGarden, isPublished, myApplication, recruitmentsOf } from '../data/selectors';
import type { Application, Db, PriorityType, User } from '../types';
import { fail, ok, type Res } from './workflow';

export const PRIORITY_OPTIONS: { value: PriorityType; label: string; hint: string }[] = [
  { value: '없음', label: '해당 없음', hint: '일반 신청입니다.' },
  { value: '다자녀', label: '다자녀 가구', hint: '세부 기준과 증빙 방법은 운영지침에 따릅니다.' },
  { value: '취약계층', label: '취약계층', hint: '세부 기준과 증빙 방법은 운영지침에 따릅니다.' },
  { value: '노인', label: '노인', hint: '세부 기준과 증빙 방법은 운영지침에 따릅니다.' },
];

/** 신청 자격 확인. 사유가 있으면 신청할 수 없다. */
export function eligibilityBlock(db: Db, user: User): string | null {
  if (db.settings.residentOnly && !user.isSiheungResident) return '시흥시민만 신청할 수 있습니다.';
  return null;
}

/** 이번 시즌 이미 유효한 신청이 있으면 그 신청을 돌려준다. (한 시즌에 1인 1건) */
export function existingApplication(db: Db, userId: string): Application | undefined {
  return myApplication(db, userId, currentSeasonKey(db));
}

/** 이 텃밭에 지망으로 신청할 수 있는지 (지정 + 이번 시즌 모집 중). 막히면 사유. */
export function gardenApplyBlock(db: Db, gardenId: string): string | null {
  const g = getGarden(db, gardenId);
  if (!g || !isPublished(g)) return '위원회 심의를 거쳐 지정된 텃밭이 아닙니다.';
  const r = recruitmentsOf(db, currentSeasonKey(db)).find((x) => x.gardenId === gardenId);
  if (!r) return '이번 시즌에는 모집하지 않는 텃밭입니다.';
  if (r.status === '준비') return '아직 모집 기간이 시작되지 않았습니다.';
  if (r.status === '마감') return '모집이 마감되었습니다.';
  if (r.status === '추첨완료') return '추첨이 끝난 텃밭입니다.';
  return null;
}

/** 지금 신청할 수 있는 텃밭 id 목록 (모집 중인 지정 텃밭) */
export function applicableGardenIds(db: Db): string[] {
  return db.gardens.filter((g) => gardenApplyBlock(db, g.id) === null).map((g) => g.id);
}

export interface ApplicationInput {
  userId: string;
  choices: string[];
  priorityType: PriorityType;
  agreePrivacy: boolean;
  agreeRules: boolean;
  appliedBy?: Application['appliedBy'];
}

export type BuildResult = { ok: true; application: Application } | { ok: false; error: string };

export function buildApplication(db: Db, input: ApplicationInput): BuildResult {
  const user = db.users.find((u) => u.id === input.userId);
  if (!user) return { ok: false, error: '사용자를 찾을 수 없습니다.' };

  const blocked = eligibilityBlock(db, user);
  if (blocked) return { ok: false, error: blocked };
  if (existingApplication(db, user.id)) return { ok: false, error: '이번 시즌에는 이미 신청하셨습니다. (1인 1건)' };

  const { choices } = input;
  if (choices.length < 1) return { ok: false, error: '1지망 텃밭을 선택해 주세요.' };
  if (choices.length > db.settings.maxChoices) return { ok: false, error: `지망은 최대 ${db.settings.maxChoices}곳까지 고를 수 있습니다.` };
  if (new Set(choices).size !== choices.length) return { ok: false, error: '같은 텃밭을 두 번 고를 수 없습니다.' };
  for (const id of choices) {
    const why = gardenApplyBlock(db, id);
    if (why) return { ok: false, error: `${getGarden(db, id)?.name ?? '선택한 텃밭'}: ${why}` };
  }
  if (!input.agreePrivacy) return { ok: false, error: '개인정보 수집·이용에 동의해 주세요.' };
  if (!input.agreeRules) return { ok: false, error: '텃밭 이용 규칙에 동의해 주세요.' };

  const season = currentSeasonKey(db);
  const seq = db.applications.filter((a) => a.userId === user.id && a.recruitmentSeason === season).length + 1;
  return {
    ok: true,
    application: {
      id: `app_${season}_${user.id}_${seq}`,
      userId: user.id,
      recruitmentSeason: season,
      choices,
      priorityType: input.priorityType,
      priorityVerified: false, // 자기신고 → 관리자가 확인하면 true
      residenceVerified: user.isSiheungResident, // 프로토타입: 실제 주민등록 연계 없이 계정 정보로 모의 확인
      consentAt: db.meta.today,
      status: '접수',
      assignedGardenId: null,
      waitlistNo: null,
      appliedBy: input.appliedBy ?? '본인',
    },
  };
}

/**
 * 추첨 전(접수·추첨대기)이면서, 지망한 텃밭의 모집이 아직 마감되지 않았을 때만 취소할 수 있다.
 * 마감 뒤에는 추첨 대상이 확정되므로(추첨 실행과 확정 사이에 명단이 바뀌면 안 된다) 취소할 수 없다.
 */
export function canCancel(db: Db, a: Application): boolean {
  if (a.status !== '접수' && a.status !== '추첨대기') return false;
  return a.choices.every((gid) => {
    const r = db.recruitments.find((x) => x.gardenId === gid && `${x.year}-${x.season}` === a.recruitmentSeason);
    return !r || r.status === '준비' || r.status === '모집중';
  });
}

/** 신청 진행 단계: 신청완료 → 추첨대기 → 결과(당첨/낙첨/대기번호) → 수락 → 이용중 (SPEC 3.1-5) */
export const FLOW_STEPS = ['신청완료', '추첨대기', '추첨 결과', '수락', '이용중'] as const;

export function flowIndex(db: Db, a: Application): number | null {
  switch (a.status) {
    case '접수':
      return 0;
    case '추첨대기':
      return 1;
    case '당첨':
    case '대기':
    case '낙첨':
      return 2;
    case '수락': {
      const using = db.plots.some((p) => p.userId === a.userId && p.gardenId === a.assignedGardenId && p.status === '이용중');
      return using ? 4 : 3;
    }
    default:
      return null; // 포기·취소는 흐름에서 벗어난 종료 상태
  }
}

// ───────── 관리자 대리 신청 (SPEC 3.2-10) ─────────

export interface NewApplicant {
  name: string;
  /** 연락처 (예: 010-1234-5678) */
  phone: string;
  /** 거주 행정동 */
  dong: string;
  /** 관리자가 신분증 등으로 시흥시 거주를 확인했는지 */
  isSiheungResident: boolean;
}

export interface ProxyInput {
  /** 이미 등록된 시민 */
  userId?: string;
  /** 시스템에 없는 신청자(예: 고령자)를 새로 등록해서 신청 */
  newApplicant?: NewApplicant;
  choices: string[];
  priorityType: PriorityType;
  /** 관리자가 우선 배정 증빙을 직접 확인했는지 */
  priorityVerified: boolean;
  /** 신청자 본인의 개인정보 수집·이용 및 이용 규칙 동의를 직접 확인했음 (대리인이 대신 동의할 수 없다) */
  consentConfirmed: boolean;
  channel: NonNullable<Application['proxyChannel']>;
}

export interface ProxyResult {
  applicationId: string;
  userId: string;
  /** 신청자를 새로 등록했는지 */
  created: boolean;
}

const PHONE = /^0\d{1,2}-?\d{3,4}-?\d{4}$/;

/**
 * 디지털 취약 계층(고령자 등)을 위해 관리자가 신청을 대신 입력한다.
 * 자격(시흥시민)·1인 1건·지망 검증은 본인 신청과 똑같이 적용되고, 실패하면 새 신청자도 만들어지지 않는다.
 */
export function proxyApply(db: Db, input: ProxyInput, byId: string): Res<ProxyResult> {
  if (db.users.find((u) => u.id === byId)?.role !== '관리자') return fail('텃밭지원과 관리자만 할 수 있는 작업입니다.');
  if (!input.consentConfirmed) return fail('신청자 본인의 개인정보 수집·이용 및 이용 규칙 동의를 직접 확인한 뒤 입력해 주세요.');
  if (!input.userId && !input.newApplicant) return fail('신청자를 선택하거나 새로 입력해 주세요.');

  let userId = input.userId ?? '';
  let created: User | null = null;
  if (input.newApplicant) {
    const n = input.newApplicant;
    if (n.name.trim().length < 2) return fail('신청자 이름을 2자 이상 입력해 주세요.');
    if (!PHONE.test(n.phone.trim())) return fail('연락처를 올바르게 입력해 주세요. (예: 010-1234-5678)');
    if (!n.dong.trim()) return fail('거주 행정동을 입력해 주세요.');
    let seq = db.users.filter((u) => u.id.startsWith('u_p')).length + 1;
    while (db.users.some((u) => u.id === `u_p${String(seq).padStart(3, '0')}`)) seq++;
    userId = `u_p${String(seq).padStart(3, '0')}`;
    created = {
      id: userId, name: n.name.trim(), role: '시민', dong: n.dong.trim(), isSiheungResident: n.isSiheungResident,
      priorityTypes: input.priorityType === '없음' ? [] : [input.priorityType], phone: n.phone.trim(),
    };
  }

  // 복사본에서 먼저 시험해 본다 (실패하면 새 신청자도 남기지 않는다)
  const trial = structuredClone(db);
  if (created) trial.users.push(created);
  const built = buildApplication(trial, {
    userId, choices: input.choices, priorityType: input.priorityType, agreePrivacy: true, agreeRules: true, appliedBy: '관리자대리',
  });
  if (!built.ok) return fail(built.error);

  const application: Application = {
    ...built.application,
    priorityVerified: input.priorityType !== '없음' && input.priorityVerified,
    proxyChannel: input.channel,
  };
  if (created) db.users.push(created);
  db.applications.push(application);
  return ok({ applicationId: application.id, userId, created: !!created });
}
