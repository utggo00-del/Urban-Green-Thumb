import type { DemoRole, FacilityKey, PolicySettings } from './types';

/** 시연 기준일(오늘). 심사 시점과 무관하게 D-day가 일정하게 보이도록 고정한다. */
export const DEMO_TODAY = '2026-09-20';

/** 부서명은 가칭이며 임의로 바꾸지 않는다. */
export const DEPARTMENT = '텃밭지원과(가칭)';

/** 앱 이름: 참도시농부(시흥시 텃밭 분양 서비스) */
export const SERVICE_SHORT_NAME = '참도시농부';
export const SERVICE_TAGLINE = '시흥시 텃밭 분양 서비스';
export const SERVICE_NAME = `${SERVICE_SHORT_NAME}(${SERVICE_TAGLINE})`;

/**
 * 조례에 규정이 없는 정책의 기본값 (시행규칙·운영지침으로 정해야 하는 사항).
 * 대회 출품용 기획이므로 모두 설정값이며, 실제 도입 시 시행규칙 확인이 필요하다.
 */
export const DEFAULT_POLICY: PolicySettings = {
  residentOnly: true,
  maxChoices: 3,
  priorityQuotaRatio: 0.3, // 가정값 — 정책에 따라 조정 가능
  acceptDeadlineDays: 5,
  waitlistRatio: 1, // 가정값 — 대기 인원 상한 = 모집 구획 수 × 1
  requirePriorityVerification: true,
  warningLimit: 3, // 경고 3회 누적 시 회수 (조례에 규정 없음 — 운영지침 사항)
  usageTermMonths: 8, // 가정값 — 봄~가을 농사철 기준 이용 기간
  seasonWindows: {
    봄: { startMonth: 2, endMonth: 3 },
    가을: { startMonth: 8, endMonth: 9 },
  },
  publicGardenFee: 10000,
  seasonMeetingLink: { 봄: '상반기', 가을: '하반기' },
};

/**
 * 위원회 의결 규칙 (조례 제4조·제8조). 코드 상수로 분리한다.
 * - 개회: 재적위원 과반 출석 (출석 > 재적 × quorumRatio)
 * - 의결: 출석위원 과반 찬성 (찬성 > 출석 × passRatio)
 */
export const COMMITTEE_RULES = {
  maxMembers: 15,
  quorumRatio: 0.5,
  passRatio: 0.5,
  regularMeetingsPerYear: 2,
  termYears: 2,
} as const;

export const ORDINANCE = {
  name: '시흥시 도시농업 활성화 지원 조례',
  number: '조례 제2528호',
  effectiveFrom: '2025.10.2.',
  lawUrl: 'https://www.law.go.kr/자치법규/시흥시도시농업활성화지원조례',
} as const;

/** 관리자 실무 검수 체크리스트 (SPEC 3.2-2, 조례 제11조) */
export const INSPECTION_ITEMS = [
  '소유(사용권) 확인 서류 확인',
  '소유자 동의서 확인 (조례 제11조)',
  '면적·구획 수 적정',
  '급수·접근성 확인',
  '최소 제공 기간 충족',
] as const;

/** 행정동 중심 좌표(가상). 새 텃밭 등록 시 지도 위치를 대신한다. 실서비스에서는 주소 검색·지도 지정으로 대체. */
export const DONG_CENTERS: Record<string, [number, number]> = {
  정왕동: [37.3448, 126.7365],
  배곧동: [37.3725, 126.7268],
  은행동: [37.4415, 126.8012],
  월곶동: [37.3915, 126.7405],
  거모동: [37.3858, 126.7822],
  장곡동: [37.4172, 126.7981],
  능곡동: [37.3841, 126.8104],
  신천동: [37.4462, 126.7885],
  대야동: [37.4436, 126.7915],
  목감동: [37.3987, 126.8664],
};

/** 시연 편의: 회의 예정일 전이라도 개회할 수 있게 한다. (실서비스에서는 false) */
export const DEMO = { allowEarlyMeeting: true } as const;

/** “시연용 샘플 서류 첨부” 버튼이 채우는 파일명 (프로토타입은 파일명만 저장) */
export const SAMPLE_DOCS = {
  land: ['토지대장(샘플).pdf', '토지이용계획확인서(샘플).pdf'],
  consent: '소유자동의서(샘플).pdf',
} as const;

export const FACILITY_LABELS: Record<FacilityKey, string> = {
  water: '급수',
  toolShed: '농기구함',
  parking: '주차',
  restroom: '화장실',
  wheelchair: '휠체어 접근',
};

// ───────── 시연 역할 ─────────
export interface DemoRoleInfo {
  label: string;
  short: string;
  /** 역할 전환 시 이동할 홈 경로 */
  home: string;
  defaultUserId: string;
}

export const DEMO_ROLES: Record<DemoRole, DemoRoleInfo> = {
  citizen: { label: '시민', short: '시민(신청자)', home: '/', defaultUserId: 'u_c001' },
  provider: { label: '텃밭 제공자', short: '텃밭 제공자', home: '/', defaultUserId: 'u_o_prov' },
  admin: { label: '관리자(간사)', short: '텃밭지원과 관리자', home: '/admin', defaultUserId: 'u_admin1' },
  member: { label: '심의위원', short: '도시농업위원회 위원', home: '/committee', defaultUserId: 'u_member05' },
};

export const DEMO_ROLE_ORDER: DemoRole[] = ['citizen', 'provider', 'admin', 'member'];

/** 시민 역할에서 고를 수 있는 시연 계정 */
export const DEMO_CITIZEN_ACCOUNTS: { userId: string; hint: string }[] = [
  { userId: 'u_c001', hint: '시흥시민 · 일반' },
  { userId: 'u_c002', hint: '시흥시민 · 다자녀(우선 배정)' },
  { userId: 'u_c003', hint: '타 지역 거주 · 신청 불가 시연' },
  { userId: 'u_a001', hint: '신청 완료(추첨대기) · 봄 낙첨 이력' },
  { userId: 'u_a014', hint: '신청 완료 · 3지망' },
  { userId: 'u_s001', hint: '이용중 · 민간 텃밭 · 경고 2회(회수 직전)' },
  { userId: 'u_s017', hint: '이용중 · 공공 텃밭 · 경고 1회' },
];

export interface GuideStep {
  title: string;
  role: DemoRole;
  path: string;
  body: string;
  /** 이 단계에서 눈여겨볼 것 */
  checks: string[];
}

/** 심사위원용 5단계 시연 시나리오 (SPEC 8.2). 처음부터 순서대로 하면 끊김 없이 이어진다. */
export const DEMO_GUIDE_STEPS: GuideStep[] = [
  {
    title: '시민 · 텃밭 찾기에서 3곳 지망 신청',
    role: 'citizen',
    path: '/gardens',
    body: '텃밭 찾기 → 상세 → 분양 신청까지 시민의 흐름이에요. 상단 계정 선택에서 “타 지역 거주” 계정으로 바꾸면 신청이 막히는 것도 볼 수 있어요.',
    checks: [
      '위원회 심의를 거쳐 지정된 텃밭 12곳만 보여요 (지도·목록 전환, 필터 6종)',
      '상세의 “위원회 심의 완료(○년 제○회, 일자)” 배지와 조례 제11조 안내',
      '신청서에서 1~3지망, 우선 배정 자기신고, 동의 후 제출 → 내 신청에서 진행 단계 확인',
    ],
  },
  {
    title: '개인 소유자 · 내 땅 텃밭 등록 신청',
    role: 'provider',
    path: '/register/new',
    body: '텃밭 제공자로 전환해 내 땅을 등록해요. 서류가 없으면 “시연용 샘플 서류 첨부” 버튼을 쓰세요.',
    checks: ['빈 폼을 제출하면 오류 요약이 나오고 입력란으로 안내돼요', '소유자 동의서가 필수예요 (조례 제11조)', '제출하면 “검수중” 상태와 다음 위원회 회의 D-day가 보여요'],
  },
  {
    title: '관리자(간사) · 검수 → 안건 상정 → 위원 투표 → 의결',
    role: 'admin',
    path: '/admin/review',
    body: '① 등록 실무 검수에서 방금 등록한 텃밭을 심의 상정 → ② 위원회 관리에서 2026년 제2회 정례회의에 안건 상정 → ③ 심의위원으로 전환해 출석 체크 → ④ 간사로 돌아와 개회·의결 → ⑤ 시민 화면에서 공개 확인.',
    checks: [
      '회의 화면의 시연 도우미 “6명만 출석”으로 개회 요건 미달(재적 과반 미달) 시 개회가 막히는 것을 볼 수 있어요',
      '심의위원 화면에서 찬성·반대·보류 투표 → 간사 화면에 자동 집계되고 가결 요건이 자동 판정돼요',
      '의결 확정 후에는 수정이 잠기고, 가결되면 텃밭이 “지정”되어 시민 화면에 나타나요',
    ],
  },
  {
    title: '관리자 · 추첨 실행 → 확정·발표 → 수락·승계',
    role: 'admin',
    path: '/admin/draw',
    body: '마감된 텃밭 묶음(은행 푸른잎·장곡 다솜)을 추첨해요. 결과는 확정·발표 전에는 시민에게 보이지 않아요.',
    checks: [
      '우선 배정 자기신고 확인 처리 → 시드값 지정 → 추첨 실행 → 결과 요약 → 확정·발표',
      '감사 로그에 시각·실행자·대상 수·시드값이 남고, 폐기한 추첨도 지워지지 않아요',
      '분양·이용자 관리의 “기한 경과 시뮬레이션”으로 미수락 자동 포기와 대기자 승계를 볼 수 있어요',
    ],
  },
  {
    title: '관리자 · 경고 부여 → 회수 확정 → 대기자 승계',
    role: 'admin',
    path: '/admin/warnings',
    body: '경고 2회인 이용자(경고·회수 관리 표의 맨 위)에게 3번째 경고를 줘요. 앞 단계에서 추첨을 마쳤다면 회수한 구획이 대기 1번에게 승계돼요.',
    checks: [
      '사유 없이는 경고를 줄 수 없어요',
      '3회에 도달하면 “회수 대기”가 되고, 이용자 화면(시민 → 해당 계정)에 회수 대상 배너가 떠요',
      '회수 확정 → 구획이 공실로 돌아가고 대기자에게 넘어가요. 새 이용자는 경고 0회로 시작해요',
    ],
  },
];

export interface GuideExtra {
  title: string;
  role: DemoRole;
  path: string;
  body: string;
}

/** 5단계 밖의 볼거리 */
export const DEMO_GUIDE_EXTRAS: GuideExtra[] = [
  { title: '시민 · 텃밭 추천 도우미 (AI 모의)', role: 'citizen', path: '/helper', body: '사는 동·이동수단·경험·관심 작물을 고르면 조건에 맞는 텃밭과 이번 시즌 작물을 추천해요.' },
  { title: '관리자 · 통계와 AI 인사이트', role: 'admin', path: '/admin/stats', body: '시즌별 배정률, 유형·행정동 분포, 우선 배정 비율 차트와 “다음 시즌 어느 동에 텃밭이 부족한가” 요약을 볼 수 있어요.' },
  { title: '관리자 · 대리 신청 입력', role: 'admin', path: '/admin/proxy', body: '디지털 취약 계층(고령자)을 위해 방문·전화·우편 접수를 대신 입력해요.' },
  { title: '관리자 · 공지·알림 관리', role: 'admin', path: '/admin/notices', body: '공지를 올리고 알림 발송 내역(모의)을 확인해요.' },
  { title: '누구나 · 근거 조례', role: 'citizen', path: '/ordinance', body: '조례 조문 요약이 앱 기능과 어떻게 연결되는지, 시행규칙으로 정해야 할 정책의 설정값을 볼 수 있어요.' },
];
