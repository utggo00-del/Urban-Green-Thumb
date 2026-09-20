// 데이터 모델 (SPEC 4장). 모든 예시 데이터는 시연용 가상 데이터입니다.

export type SeasonName = '봄' | '가을';
/** 예: "2026-가을" */
export type SeasonKey = `${number}-${SeasonName}`;

// ───────── 텃밭 ─────────
export type OwnerKind = '공공' | '민간' | '개인';
export type OrdinanceType = '도시텃밭' | '상자텃밭' | '학습·생태체험텃밭';
export type GardenStatus =
  | '검수중'
  | '심의대기'
  | '심의중'
  | '지정'
  | '부결'
  | '보류'
  | '운영중'
  | '중단';
export type FacilityKey = 'water' | 'toolShed' | 'parking' | 'restroom' | 'wheelchair';

export interface BankAccount {
  bank: string;
  number: string;
  holder: string;
}

/** 위원회 심의를 통과해 지정된 기록 (조례 제5조·제11조) */
export interface Designation {
  agendaId: string | null;
  meetingId: string | null;
  /** 회의 종류(정례·임시). 회차는 연도·종류별로 센다. */
  meetingKind: MeetingKind;
  /** 해당 연도 안에서의 회차 (예: 2026년 제1회 정례회의 → 1). 연도는 decidedAt에서 얻는다. */
  round: number;
  /** 의결일 (YYYY-MM-DD) */
  decidedAt: string;
  /** 기존 조성 텃밭을 관리자가 회차·일자를 입력해 이관 등록한 경우 */
  migrated?: boolean;
}

/** 관리자 실무 검수 결과 (심의위원이 안건 상세에서 열람) */
export interface Inspection {
  checklist: Record<string, boolean>;
  opinion: string;
  inspectedAt: string;
  inspectedBy: string;
}

/** 등록·심의 진행 이력 (제공자 화면의 타임라인) */
export interface GardenEvent {
  at: string;
  label: string;
  note?: string;
}

export interface Garden {
  id: string;
  name: string;
  type: OwnerKind;
  ordinanceType: OrdinanceType;
  ownerId: string;
  address: string;
  /** 행정동 */
  dong: string;
  lat: number;
  lng: number;
  totalAreaM2: number;
  plotCount: number;
  plotAreaM2: number;
  facilities: FacilityKey[];
  rules: string;
  /** 원/시즌, 0이면 무료 */
  fee: number;
  /** 민간·개인만. 당첨 확정 후에만 시민에게 공개 */
  feeAccount?: BankAccount;
  status: GardenStatus;
  /** 보완 요청·부결·보류 사유 */
  reviewNote?: string;
  documents: string[];
  /** 소유자 동의서 파일명 (조례 제11조, 필수) */
  ownerConsentDoc: string;
  /** 민간 텃밭의 주말농원사업자(도시텃밭운영자) 여부. 표시만 한다. */
  isWeekendFarmOperator?: boolean;
  designation?: Designation;
  inspection?: Inspection;
  /** 최소 제공 기간(개월) */
  seasonMinTerm: number;
  createdAt: string;
  history?: GardenEvent[];
}

// ───────── 모집 ─────────
export type RecruitmentStatus = '준비' | '모집중' | '마감' | '추첨완료';

export interface Recruitment {
  id: string;
  year: number;
  season: SeasonName;
  gardenId: string;
  applyStart: string;
  applyEnd: string;
  drawDate: string;
  acceptDeadlineDays: number;
  status: RecruitmentStatus;
  plotsOffered: number;
  /** 우선 배정 몫 비율(기본 30%, 정책에 따라 조정 가능) */
  priorityQuotaRatio: number;
}

// ───────── 구획 ─────────
export type PlotStatus = '공실' | '배정' | '이용중' | '회수대기' | '회수';

export interface Plot {
  id: string;
  gardenId: string;
  number: number;
  status: PlotStatus;
  userId: string | null;
  /** 현재 이용자가 이 구획에서 받은 경고 횟수 (Warning 기록에서 이용자별로 센다) */
  warningCount: number;
  /** 이용 기간 (수락일 ~ 수락일 + 이용 기간 설정). 이용중일 때만 있다. */
  usageStart?: string;
  usageEnd?: string;
}

// ───────── 신청 ─────────
export type PriorityKind = '다자녀' | '취약계층' | '노인';
export type PriorityType = PriorityKind | '없음';
export type ApplicationStatus =
  | '접수'
  | '추첨대기'
  | '당첨'
  | '대기'
  | '낙첨'
  | '수락'
  | '포기'
  | '취소';

export interface Application {
  id: string;
  userId: string;
  recruitmentSeason: SeasonKey;
  /** 지망 순위대로, 최대 3곳 */
  choices: string[];
  priorityType: PriorityType;
  /** 우선 배정 자기신고에 대한 관리자 확인 여부 */
  priorityVerified: boolean;
  residenceVerified: boolean;
  consentAt: string;
  status: ApplicationStatus;
  assignedGardenId: string | null;
  waitlistNo: number | null;
  /** 당첨·승계 후 수락 기한 (YYYY-MM-DD) */
  acceptDeadlineAt?: string;
  /** 대기 중인 텃밭과 대기번호 (지망 순서). waitlistNo는 첫 항목의 번호. 지망 텃밭마다 대기번호가 따로 있다. */
  waitlist?: { gardenId: string; no: number }[];
  appliedBy: '본인' | '관리자대리';
  /** 관리자 대리 신청의 접수 방식 */
  proxyChannel?: '방문' | '전화' | '우편';
}

// ───────── 경고 · 추첨 로그 ─────────
export interface Warning {
  id: string;
  plotId: string;
  userId: string;
  reason: string;
  issuedAt: string;
  issuedBy: string;
}

export type DrawResultKind = '당첨' | '대기' | '낙첨';

export interface DrawResultRow {
  applicationId: string;
  userId: string;
  result: DrawResultKind;
  waitlistNo?: number;
  /** 당첨 경로: 우선 몫 추첨 / 일반 추첨 / 무추첨 전원 배정 */
  group?: '우선' | '일반' | '전원';
  /** 몇 지망으로 당첨(또는 대기)했는지 */
  choiceRank?: number;
}

/** 미확정: 실행만 됨(시민에게 비공개) / 확정: 확정·발표됨 / 폐기: 사유를 남기고 취소됨 */
export type DrawStatus = '미확정' | '확정' | '폐기';

export interface DrawLog {
  id: string;
  gardenId: string;
  recruitmentSeason: SeasonKey;
  executedAt: string;
  executedBy: string;
  applicantCount: number;
  plotCount: number;
  seed: number;
  priorityGroupCount: number;
  /** "무추첨 전원 배정" 등 실행 방식 메모 */
  note?: string;
  /** 같은 묶음(지망이 서로 얽힌 텃밭들)을 한 번에 추첨한 기록은 같은 groupId를 가진다 */
  groupId?: string;
  status?: DrawStatus;
  confirmedAt?: string;
  discardReason?: string;
  resultSnapshot: DrawResultRow[];
}

/** 당첨 포기·기한 경과·회수로 나온 빈 구획이 대기자에게 넘어간 기록 */
export interface Succession {
  id: string;
  at: string;
  gardenId: string;
  plotId: string;
  reason: '포기' | '기한 경과' | '회수';
  /** 구획을 내놓은 신청·이용자 */
  fromUserId: string;
  /** 승계받은 신청. 대기자가 없으면 null(재모집 필요) */
  toApplicationId: string | null;
  toUserId: string | null;
  note?: string;
}

// ───────── 사용자 ─────────
export type UserRole = '시민' | '제공자' | '관리자' | '심의위원';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  dong: string;
  isSiheungResident: boolean;
  priorityTypes: PriorityKind[];
  phone: string;
  /** 관리자 중 도시농업 담당주무관 = 위원회 간사 (조례 제9조) */
  isCommitteeSecretary?: boolean;
  /** 심의위원 계정과 위원 정보 연결 */
  memberId?: string;
}

// ───────── 위원회 ─────────
export type MemberPosition = '위원장' | '부위원장' | '위원';
export type MemberCategory =
  | '시의회 추천'
  | '농업기술센터 소장(당연직)'
  | '관련 기관·단체 임직원'
  | '학식·경험자'
  | '시장 인정자';

export interface CommitteeMember {
  id: string;
  name: string;
  position: MemberPosition;
  category: MemberCategory;
  termStart: string;
  termEnd: string;
  isActive: boolean;
}

export type MeetingKind = '정례' | '임시';
export type MeetingHalf = '상반기' | '하반기';
export type MeetingStatus = '예정' | '진행중' | '종료';

export interface Meeting {
  id: string;
  kind: MeetingKind;
  half: MeetingHalf | null;
  year: number;
  /** 회차 — 연도별·회의 종류별(정례/임시)로 1부터 센다. 등록 시 자동 부여(lib/meeting.ts nextRound) */
  round: number;
  /** ISO 일시 (YYYY-MM-DDTHH:mm) */
  scheduledAt: string;
  place: string;
  status: MeetingStatus;
  attendeeIds: string[];
  /** 재적위원 수 */
  totalMembers: number;
  /** 출석위원 수 */
  attendeeCount: number;
  quorumMet: boolean;
  minutesDoc?: string;
}

export type AgendaKind = '도시텃밭 지정' | '상자텃밭 보급' | '계획 수립·변경' | '기타';
export type AgendaResult = '가결' | '부결' | '보류' | '미의결';

export interface AgendaCorrection {
  at: string;
  by: string;
  note: string;
}

export interface Agenda {
  id: string;
  meetingId: string;
  kind: AgendaKind;
  gardenId: string | null;
  title: string;
  summary: string;
  result: AgendaResult;
  yes: number;
  no: number;
  abstain: number;
  /** 의결 확정 시각. 확정되면 수정 잠금 */
  decidedAt?: string;
  /** 잠금 이후 정정 기록 */
  corrections: AgendaCorrection[];
}

export type VoteChoice = '찬성' | '반대' | '보류';

export interface Vote {
  id: string;
  agendaId: string;
  memberId: string;
  choice: VoteChoice;
  comment: string;
  votedAt: string;
}

// ───────── 공지 · 알림 ─────────
export interface Notice {
  id: string;
  title: string;
  body: string;
  audience: '전체' | '이용자' | '제공자';
  createdAt: string;
  pinned?: boolean;
  authorId: string;
}

export interface NotificationLog {
  id: string;
  noticeId?: string;
  channel: '앱 알림' | '문자(모의)';
  recipientCount: number;
  message: string;
  sentAt: string;
}

// ───────── 설정 · 세션 · 전체 DB ─────────

/** 시행규칙·운영지침 사항: 하드코딩하지 않고 설정값으로 분리 (SPEC 2장·12장) */
export interface PolicySettings {
  /** 시흥시민만 신청 가능 */
  residentOnly: boolean;
  /** 지망 최대 개수 */
  maxChoices: number;
  /** 우선 배정 몫 비율 */
  priorityQuotaRatio: number;
  /** 당첨 수락 기한(일) */
  acceptDeadlineDays: number;
  /** 대기 인원 상한 = 모집 구획 수 × 이 비율(올림). 상한을 넘으면 낙첨. 0이면 대기 없이 낙첨 */
  waitlistRatio: number;
  /** 우선 배정 자기신고를 관리자가 확인해야 우선 몫 추첨에 들어간다 */
  requirePriorityVerification: boolean;
  /** 경고 누적 회수 기준 */
  warningLimit: number;
  /** 이용 기간(개월). 수락일부터 셈 */
  usageTermMonths: number;
  /** 시즌별 모집 기간(월) */
  seasonWindows: Record<SeasonName, { startMonth: number; endMonth: number }>;
  /** 공공 텃밭 기본 이용료(가상 금액) */
  publicGardenFee: number;
  /** 모집 시즌과 정례회의 연계 기본 시나리오 (임시회의로 지정된 텃밭은 추가 모집 가능) */
  seasonMeetingLink: Record<SeasonName, MeetingHalf>;
}

/** 시연용 역할 전환. 실서비스에서는 인증으로 대체 */
export type DemoRole = 'citizen' | 'provider' | 'admin' | 'member';

export interface Session {
  role: DemoRole;
  userId: string;
}

export interface Db {
  meta: {
    version: number;
    /** 시연 기준일. 결과가 언제 열어도 같도록 고정하고, 기한 경과 시뮬레이션에서 앞으로 돌린다. */
    today: string;
  };
  session: Session;
  settings: PolicySettings;
  users: User[];
  gardens: Garden[];
  recruitments: Recruitment[];
  plots: Plot[];
  applications: Application[];
  warnings: Warning[];
  drawLogs: DrawLog[];
  successions: Succession[];
  members: CommitteeMember[];
  meetings: Meeting[];
  agendas: Agenda[];
  votes: Vote[];
  notices: Notice[];
  notifications: NotificationLog[];
}
