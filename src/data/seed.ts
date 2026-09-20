// 시연용 시드 데이터 — 사람 이름·계좌·전화번호·텃밭 이름은 전부 가상입니다 (SPEC 8.1).
// 난수는 고정 시드를 쓰므로 "시연 데이터 초기화"를 눌러도 항상 같은 데이터가 만들어집니다.
import { DEFAULT_POLICY, DEMO_ROLES, DEMO_TODAY, INSPECTION_ITEMS } from '../config';
import { designationLabel } from '../lib/meeting';
import { usageEndOf } from '../lib/date';
import { mulberry32, pick, shuffle } from '../lib/random';
import { DEFAULT_RULES_TEXT } from './rules';
import type {
  Agenda,
  Application,
  CommitteeMember,
  Db,
  DrawLog,
  DrawResultRow,
  FacilityKey,
  Garden,
  GardenStatus,
  Meeting,
  MemberCategory,
  Notice,
  NotificationLog,
  OrdinanceType,
  OwnerKind,
  Plot,
  PriorityKind,
  Recruitment,
  SeasonKey,
  User,
  Warning,
} from '../types';

/** 저장 데이터의 모양이 바뀌면 올린다 — 이전 버전의 저장본은 무시하고 새 시드로 시작한다. (2: 회차를 연도별로 세고 Designation.meetingKind 추가 / 3: Garden.history, 시드 이력 / 4: 추첨 묶음·대기 목록·승계 기록 / 5: 이용 기간·경고 기준) */
export const DB_VERSION = 5;


// ───────── 가상 이름 ─────────
const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '전'];
const GIVEN = [
  '하늘', '다온', '서준', '민서', '지우', '하윤', '도현', '수아', '예준', '지안', '시우', '유진', '현우', '나연', '태윤',
  '소율', '준서', '다은', '건우', '지호', '채원', '승민', '아린', '재윤', '은서', '주원', '가온', '이안', '세아', '동훈',
  '미래', '보람', '한결', '새롬', '유나', '태민', '선우', '여름', '해솔', '다미',
];
const DONGS = ['정왕동', '배곧동', '은행동', '장곡동', '월곶동', '거모동', '능곡동', '신천동', '대야동', '목감동'];

// ───────── 텃밭 15+1곳 ─────────
type GardenRow = {
  id: string;
  name: string;
  type: OwnerKind;
  ord: OrdinanceType;
  owner: string;
  dong: string;
  lat: number;
  lng: number;
  plots: number;
  plotArea: number;
  fee: number;
  status: GardenStatus;
  weekend?: boolean;
  minTerm?: number;
};

const GARDEN_ROWS: GardenRow[] = [
  // 지정 12곳 (공공 5, 민간 4, 개인 3)
  { id: 'g01', name: '정왕 이웃 공동체 텃밭', type: '공공', ord: '도시텃밭', owner: 'u_o_city', dong: '정왕동', lat: 37.3448, lng: 126.7365, plots: 40, plotArea: 13, fee: 10000, status: '지정' },
  { id: 'g02', name: '배곧 바닷길 공공 텃밭', type: '공공', ord: '도시텃밭', owner: 'u_o_city', dong: '배곧동', lat: 37.3725, lng: 126.7268, plots: 32, plotArea: 13, fee: 10000, status: '지정' },
  { id: 'g03', name: '은행 푸른잎 공공 텃밭', type: '공공', ord: '도시텃밭', owner: 'u_o_city', dong: '은행동', lat: 37.4415, lng: 126.8012, plots: 24, plotArea: 12, fee: 10000, status: '지정' },
  { id: 'g04', name: '월곶 햇살 상자텃밭', type: '공공', ord: '상자텃밭', owner: 'u_o_city', dong: '월곶동', lat: 37.3915, lng: 126.7405, plots: 16, plotArea: 10, fee: 0, status: '지정' },
  { id: 'g05', name: '거모 배움 생태체험 텃밭', type: '공공', ord: '학습·생태체험텃밭', owner: 'u_o_city', dong: '거모동', lat: 37.3858, lng: 126.7822, plots: 12, plotArea: 16, fee: 0, status: '지정' },
  { id: 'g06', name: '장곡 다솜 주말농원', type: '민간', ord: '도시텃밭', owner: 'u_o_m1', dong: '장곡동', lat: 37.4172, lng: 126.7981, plots: 30, plotArea: 13, fee: 60000, status: '지정', weekend: true },
  { id: 'g07', name: '능곡 흙내음 농장', type: '민간', ord: '도시텃밭', owner: 'u_o_m2', dong: '능곡동', lat: 37.3841, lng: 126.8104, plots: 36, plotArea: 13, fee: 50000, status: '지정', weekend: true },
  { id: 'g08', name: '신천 새싹 텃밭', type: '민간', ord: '도시텃밭', owner: 'u_o_m3', dong: '신천동', lat: 37.4462, lng: 126.7885, plots: 20, plotArea: 11, fee: 40000, status: '지정', weekend: false },
  { id: 'g09', name: '목감 들녘 배움 텃밭', type: '민간', ord: '학습·생태체험텃밭', owner: 'u_o_m4', dong: '목감동', lat: 37.3987, lng: 126.8664, plots: 10, plotArea: 16, fee: 30000, status: '지정', weekend: false },
  { id: 'g10', name: '정왕 가온 마당 텃밭', type: '개인', ord: '도시텃밭', owner: 'u_o_prov', dong: '정왕동', lat: 37.3512, lng: 126.7431, plots: 8, plotArea: 10, fee: 30000, status: '지정' },
  { id: 'g11', name: '배곧 연둣빛 상자 텃밭', type: '개인', ord: '상자텃밭', owner: 'u_o_p2', dong: '배곧동', lat: 37.3689, lng: 126.7315, plots: 10, plotArea: 10, fee: 20000, status: '지정' },
  { id: 'g12', name: '장곡 볕든 뜰 텃밭', type: '개인', ord: '도시텃밭', owner: 'u_o_p3', dong: '장곡동', lat: 37.4098, lng: 126.8022, plots: 14, plotArea: 12, fee: 35000, status: '지정' },
  // 심의대기 2곳 · 보류 1곳
  { id: 'g13', name: '은행 두레 공동체 텃밭', type: '공공', ord: '도시텃밭', owner: 'u_o_city', dong: '은행동', lat: 37.4381, lng: 126.7955, plots: 18, plotArea: 13, fee: 10000, status: '심의대기' },
  { id: 'g14', name: '월곶 갯내음 텃밭', type: '민간', ord: '도시텃밭', owner: 'u_o_m5', dong: '월곶동', lat: 37.3962, lng: 126.7448, plots: 22, plotArea: 13, fee: 45000, status: '심의대기', weekend: true },
  { id: 'g15', name: '거모 언덕 위 텃밭', type: '개인', ord: '도시텃밭', owner: 'u_o_prov', dong: '거모동', lat: 37.3902, lng: 126.7758, plots: 9, plotArea: 11, fee: 25000, status: '보류' },
  // 실무 검수 대기 1곳 (위 15곳과 별개)
  { id: 'g16', name: '신천 마루 텃밭', type: '개인', ord: '도시텃밭', owner: 'u_o_prov', dong: '신천동', lat: 37.4489, lng: 126.7941, plots: 12, plotArea: 12, fee: 30000, status: '검수중' },
];

const FACILITY_SETS: FacilityKey[][] = [
  ['water', 'toolShed', 'parking', 'restroom', 'wheelchair'],
  ['water', 'toolShed', 'parking', 'restroom'],
  ['water', 'toolShed', 'parking'],
  ['water', 'toolShed', 'wheelchair'],
  ['water', 'parking', 'restroom'],
  ['water', 'toolShed'],
];

// 2025년 제1회·2026년 제1회 정례회의에서 지정된 텃밭. (회차는 연도별로 센다) g04는 "기존 조성 텃밭 이관 등록" 예시(회차·일자 직접 입력).
const DESIGNATED_AT: Record<string, { meeting: 'mt_1' | 'mt_2'; migrated?: boolean }> = {
  g01: { meeting: 'mt_1' },
  g02: { meeting: 'mt_1' },
  g03: { meeting: 'mt_1' },
  g04: { meeting: 'mt_1', migrated: true },
  g05: { meeting: 'mt_2' },
  g06: { meeting: 'mt_2' },
  g07: { meeting: 'mt_2' },
  g08: { meeting: 'mt_2' },
  g09: { meeting: 'mt_2' },
  g10: { meeting: 'mt_2' },
  g11: { meeting: 'mt_2' },
  g12: { meeting: 'mt_2' },
};

const MEETING_INFO = {
  mt_1: { round: 1, decidedAt: '2025-11-14' }, // 2025년 제1회 정례회의(하반기)
  mt_2: { round: 1, decidedAt: '2026-01-22' }, // 2026년 제1회 정례회의(상반기)
};

export function buildSeed(): Db {
  const rng = mulberry32(20260920);

  // ───────── 사용자 ─────────
  const usedNames = new Set<string>();
  const fakeName = () => {
    for (;;) {
      const n = pick(SURNAMES, rng) + pick(GIVEN, rng);
      if (!usedNames.has(n)) {
        usedNames.add(n);
        return n;
      }
    }
  };
  let phoneSeq = 1000;
  const phone = () => `010-0000-${String(phoneSeq++).padStart(4, '0')}`;

  const users: User[] = [];
  const addUser = (u: Partial<User> & Pick<User, 'id' | 'name' | 'role'>) =>
    users.push({
      dong: pick(DONGS, rng),
      isSiheungResident: true,
      priorityTypes: [],
      phone: phone(),
      ...u,
    });

  // 시연 시민 계정 3종
  addUser({ id: 'u_c001', name: '김하늘', role: '시민', dong: '정왕동' });
  addUser({ id: 'u_c002', name: '이다온', role: '시민', dong: '배곧동', priorityTypes: ['다자녀'] });
  addUser({ id: 'u_c003', name: '박서준', role: '시민', dong: '안산시 상록구(타 지역)', isSiheungResident: false });
  ['김하늘', '이다온', '박서준'].forEach((n) => usedNames.add(n)); // 시연 계정 이름과 겹치지 않게

  // 제공자(소유자)
  addUser({ id: 'u_o_prov', name: '오가람', role: '제공자', dong: '정왕동' });
  addUser({ id: 'u_o_city', name: '시흥시(공공 소유)', role: '제공자', dong: '시청' });
  ['m1', 'm2', 'm3', 'm4', 'm5'].forEach((k) => addUser({ id: `u_o_${k}`, name: fakeName(), role: '제공자' }));
  addUser({ id: 'u_o_p2', name: fakeName(), role: '제공자' });
  addUser({ id: 'u_o_p3', name: fakeName(), role: '제공자' });

  // 관리자 (담당주무관 = 위원회 간사)
  addUser({ id: 'u_admin1', name: '한지원', role: '관리자', dong: '시청', isCommitteeSecretary: true });
  addUser({ id: 'u_admin2', name: '류하준', role: '관리자', dong: '시청' });

  // 이번 시즌(가을) 신청자 60명 — 우선 배정 대상 12명(20%)
  const applicantIds: string[] = [];
  for (let i = 1; i <= 60; i++) {
    const id = `u_a${String(i).padStart(3, '0')}`;
    applicantIds.push(id);
    addUser({ id, name: fakeName(), role: '시민' });
  }

  // 봄 시즌 이용자 30명 (구획 이용중)
  const holderIds: string[] = [];
  for (let i = 1; i <= 30; i++) {
    const id = `u_s${String(i).padStart(3, '0')}`;
    holderIds.push(id);
    addUser({ id, name: fakeName(), role: '시민' });
  }

  // ───────── 위원회 ─────────
  const memberRows: [string, MemberCategory, CommitteeMember['position']][] = [
    ['정도윤', '학식·경험자', '위원장'],
    ['오서연', '시의회 추천', '부위원장'],
    ['문재석', '시장 인정자', '위원'],
    ['고은우', '농업기술센터 소장(당연직)', '위원'],
    ['서지현', '관련 기관·단체 임직원', '위원'],
    ['배승훈', '관련 기관·단체 임직원', '위원'],
    ['허민아', '관련 기관·단체 임직원', '위원'],
    ['류태호', '학식·경험자', '위원'],
    ['안소희', '학식·경험자', '위원'],
    ['노해든', '학식·경험자', '위원'],
    ['송하람', '시장 인정자', '위원'],
    ['양이든', '시장 인정자', '위원'],
  ];
  const members: CommitteeMember[] = memberRows.map(([name, category, position], i) => ({
    id: `cm_${String(i + 1).padStart(2, '0')}`,
    name,
    position,
    category,
    termStart: '2025-11-01',
    termEnd: '2027-10-31', // 임기 2년, 연임 가능
    isActive: true,
  }));
  addUser({ id: 'u_member05', name: '서지현', role: '심의위원', dong: '시청', memberId: 'cm_05' });
  const memberIds = members.map((m) => m.id);

  // ───────── 텃밭 ─────────
  const gardens: Garden[] = GARDEN_ROWS.map((r, idx) => {
    const d = DESIGNATED_AT[r.id];
    const designated = r.status === '지정';
    const g: Garden = {
      id: r.id,
      name: r.name,
      type: r.type,
      ordinanceType: r.ord,
      ownerId: r.owner,
      address: `경기도 시흥시 ${r.dong} ${100 + idx * 7}번지 일원(가상)`,
      dong: r.dong,
      lat: r.lat,
      lng: r.lng,
      plotCount: r.plots,
      plotAreaM2: r.plotArea,
      totalAreaM2: Math.round(r.plots * r.plotArea * 1.6),
      facilities: FACILITY_SETS[idx % FACILITY_SETS.length],
      rules: DEFAULT_RULES_TEXT,
      fee: r.fee,
      status: r.status,
      documents: [`토지대장_${r.id}.pdf`, `토지이용계획확인서_${r.id}.pdf`],
      ownerConsentDoc: r.type === '공공' ? `소유자동의서(시 소유·관리부서 확인)_${r.id}.pdf` : `소유자동의서_${r.id}.pdf`,
      seasonMinTerm: r.minTerm ?? (r.type === '개인' ? 6 : 12),
      createdAt: designated ? '2025-10-20' : r.id === 'g15' ? '2025-12-15' : r.id === 'g16' ? '2026-09-15' : '2026-08-20',
    };
    if (r.type !== '공공') {
      g.feeAccount = {
        bank: '가상은행',
        number: `110-${200 + idx}-${700000 + idx * 137}`,
        holder: users.find((u) => u.id === r.owner)!.name,
      };
    }
    if (r.type === '민간') g.isWeekendFarmOperator = !!r.weekend;
    if (d) {
      const info = MEETING_INFO[d.meeting];
      g.designation = {
        agendaId: d.migrated ? null : `ag_${d.meeting}_${r.id}`,
        meetingId: d.meeting,
        meetingKind: '정례',
        round: info.round,
        decidedAt: info.decidedAt,
        ...(d.migrated ? { migrated: true } : {}),
      };
    }
    if (r.status !== '검수중') {
      g.inspection = {
        checklist: Object.fromEntries(INSPECTION_ITEMS.map((k) => [k, true])),
        opinion: '서류와 현장 사진을 확인했으며 요건을 충족하여 위원회 심의에 상정합니다.',
        inspectedAt: designated ? '2025-11-05' : r.id === 'g15' ? '2026-01-05' : '2026-09-08',
        inspectedBy: 'u_admin1',
      };
    }
    g.history = [{ at: g.createdAt, label: '등록 신청' }];
    if (g.inspection) g.history.push({ at: g.inspection.inspectedAt, label: '실무 검수 통과 · 심의 상정' });
    if (g.designation) {
      g.history.push(
        g.designation.migrated
          ? { at: g.designation.decidedAt, label: '기존 지정 텃밭 이관 등록', note: designationLabel(g.designation) }
          : { at: g.designation.decidedAt, label: '위원회 심의 가결 → 지정', note: designationLabel(g.designation) },
      );
    }
    if (r.id === 'g15') {
      g.history.push({ at: '2026-01-22', label: '위원회 심의 보류', note: '진입로 안전시설 보완 후 재상정' });
      g.reviewNote =
        '보류(2026년 제1회 정례회의): 진입로 안전시설 보완 후 다음 회의에 재상정해 주세요. (시연용 가상 사유)';
    }
    return g;
  });

  // ───────── 회의·안건 ─────────
  const attendees = (n: number) => memberIds.slice(0, n);
  const meetings: Meeting[] = [
    {
      id: 'mt_1', kind: '정례', half: '하반기', year: 2025, round: 1,
      scheduledAt: '2025-11-14T14:00', place: '시흥시청 회의실(가상)', status: '종료',
      attendeeIds: attendees(10), totalMembers: 12, attendeeCount: 10, quorumMet: true,
      minutesDoc: '2025년_제1회_도시농업위원회_회의록(가상).pdf',
    },
    {
      id: 'mt_2', kind: '정례', half: '상반기', year: 2026, round: 1,
      scheduledAt: '2026-01-22T14:00', place: '시흥시청 회의실(가상)', status: '종료',
      attendeeIds: attendees(11), totalMembers: 12, attendeeCount: 11, quorumMet: true,
      minutesDoc: '2026년_제1회_도시농업위원회_회의록(가상).pdf',
    },
    {
      id: 'mt_3', kind: '정례', half: '하반기', year: 2026, round: 2,
      scheduledAt: '2026-10-15T14:00', place: '시흥시청 회의실(가상)', status: '예정',
      attendeeIds: [], totalMembers: 12, attendeeCount: 0, quorumMet: false,
    },
  ];

  const agendas: Agenda[] = [];
  for (const [gid, d] of Object.entries(DESIGNATED_AT)) {
    if (d.migrated) continue;
    const g = gardens.find((x) => x.id === gid)!;
    const m = meetings.find((x) => x.id === d.meeting)!;
    agendas.push({
      id: `ag_${d.meeting}_${gid}`,
      meetingId: d.meeting,
      kind: g.ordinanceType === '상자텃밭' ? '상자텃밭 보급' : '도시텃밭 지정',
      gardenId: gid,
      title: `${g.name} 지정(안)`,
      summary: `${g.type} 텃밭 · ${g.ordinanceType} · ${g.plotCount}구획 (조례 제11조)`,
      result: '가결',
      yes: m.attendeeCount - 1,
      no: 0,
      abstain: 1,
      decidedAt: MEETING_INFO[d.meeting].decidedAt,
      corrections: [],
    });
  }
  agendas.push(
    {
      id: 'ag_mt_2_g15', meetingId: 'mt_2', kind: '도시텃밭 지정', gardenId: 'g15',
      title: '거모 언덕 위 텃밭 지정(안)', summary: '개인 텃밭 · 도시텃밭 · 9구획 (조례 제11조)',
      result: '보류', yes: 4, no: 2, abstain: 5, decidedAt: '2026-01-22', corrections: [],
    },
    {
      id: 'ag_mt_2_plan', meetingId: 'mt_2', kind: '계획 수립·변경', gardenId: null,
      title: '2026년 도시농업 활성화 계획 수립(안)', summary: '연 2회 시즌 모집 운영 계획 (조례 제5조)',
      result: '가결', yes: 11, no: 0, abstain: 0, decidedAt: '2026-01-22', corrections: [],
    },
  );

  // ───────── 모집 ─────────
  const rc = (
    id: string, year: number, season: '봄' | '가을', gardenId: string, start: string, end: string, draw: string,
    status: Recruitment['status'], offered: number,
  ): Recruitment => ({
    id, year, season, gardenId, applyStart: start, applyEnd: end, drawDate: draw,
    acceptDeadlineDays: DEFAULT_POLICY.acceptDeadlineDays, status, plotsOffered: offered,
    priorityQuotaRatio: DEFAULT_POLICY.priorityQuotaRatio,
  });

  // 봄(완료) — 이력 확인용
  const holdersByGarden: Record<string, string[]> = {
    g06: holderIds.slice(0, 4),   // s001~s004 (s001 = 경고 2회, "3회 직전" 이용자)
    g01: holderIds.slice(4, 16),  // s005~s016
    g02: holderIds.slice(16, 22), // s017~s022
    g03: holderIds.slice(22, 26), // s023~s026
    g07: holderIds.slice(26, 30), // s027~s030
  };
  const recruitments: Recruitment[] = Object.entries(holdersByGarden).map(([gid, hs]) =>
    rc(`rc_2026s_${gid}`, 2026, '봄', gid, '2026-02-02', '2026-03-13', '2026-03-20', '추첨완료', hs.length),
  );

  // 가을(모집 중)
  const fall: [string, Recruitment['status'], number][] = [
    ['g01', '모집중', 12], ['g02', '모집중', 10], ['g03', '마감', 6], ['g04', '모집중', 8], ['g05', '준비', 6],
    ['g06', '마감', 8], ['g07', '모집중', 10], ['g08', '모집중', 6], ['g10', '모집중', 3], ['g11', '모집중', 5],
    ['g12', '모집중', 4],
  ];
  for (const [gid, status, offered] of fall) {
    if (status === '마감') recruitments.push(rc(`rc_2026f_${gid}`, 2026, '가을', gid, '2026-08-24', '2026-09-15', '2026-09-22', status, offered));
    else if (status === '준비') recruitments.push(rc(`rc_2026f_${gid}`, 2026, '가을', gid, '2026-09-25', '2026-09-30', '2026-10-06', status, offered));
    else recruitments.push(rc(`rc_2026f_${gid}`, 2026, '가을', gid, '2026-08-24', '2026-09-30', '2026-10-06', status, offered));
  }
  const closedFall = new Set(fall.filter((f) => f[1] === '마감').map((f) => f[0]));

  // ───────── 구획 · 경고 ─────────
  const plots: Plot[] = [];
  const warnings: Warning[] = [];
  const warnPlan: Record<string, string[]> = {
    u_s001: ['잡초 방치로 인접 구획 피해(현장 점검 2026.06.18)', '작물 미식재 상태 지속(현장 점검 2026.07.30)'],
    u_s002: ['구획 밖 무단 경작(현장 점검 2026.07.09)'],
    u_s005: ['폐비닐·쓰레기 방치(현장 점검 2026.07.21)'],
    u_s017: ['미경작 신고 접수 후 점검 확인(2026.08.03)'],
  };
  for (const g of gardens.filter((x) => x.status === '지정')) {
    const hs = holdersByGarden[g.id] ?? [];
    for (let n = 1; n <= g.plotCount; n++) {
      const userId = hs[n - 1] ?? null;
      const w = userId ? warnPlan[userId] ?? [] : [];
      const plot: Plot = {
        id: `${g.id}_${String(n).padStart(2, '0')}`,
        gardenId: g.id,
        number: n,
        status: userId ? '이용중' : '공실',
        userId,
        warningCount: w.length,
        ...(userId ? { usageStart: '2026-04-01', usageEnd: usageEndOf('2026-04-01', DEFAULT_POLICY.usageTermMonths) } : {}),
      };
      plots.push(plot);
      w.forEach((reason, k) =>
        warnings.push({
          id: `w_${plot.id}_${k + 1}`,
          plotId: plot.id,
          userId: userId!,
          reason,
          issuedAt: reason.match(/\d{4}\.\d{2}\.\d{2}/)?.[0].replaceAll('.', '-') ?? '2026-07-01',
          issuedBy: 'u_admin1',
        }),
      );
    }
  }

  // ───────── 신청 ─────────
  const applications: Application[] = [];
  const priorityKinds: PriorityKind[] = ['다자녀', '다자녀', '다자녀', '다자녀', '다자녀', '취약계층', '취약계층', '취약계층', '노인', '노인', '노인', '노인'];

  // 1지망 분포 (합 60): 마감 2곳(g06 18명/8구획, g03 11명/6구획)은 추첨이 필요하고,
  // g11(3명/5구획)·g12(2명/4구획)는 "무추첨 전원 배정" 사례가 된다.
  const firstDist: [string, number][] = [['g06', 18], ['g03', 11], ['g01', 9], ['g02', 7], ['g07', 6], ['g08', 4], ['g12', 2], ['g11', 3]];
  const firstChoices = shuffle(firstDist.flatMap(([g, n]) => Array<string>(n).fill(g)), rng);
  // 지망이 서로 얽히는 범위: 마감된 텃밭(g03·g06)끼리, 모집 중인 텃밭끼리. 그래서 마감 묶음은 다른 텃밭의
  // 모집이 끝나기를 기다리지 않고 바로 함께 추첨할 수 있다. (다른 시즌 상황에서는 섞이면 함께 마감돼야 추첨 가능)
  const closedPool = ['g03', 'g06'];
  const openPool = ['g01', 'g02', 'g04', 'g07', 'g08', 'g10'];

  // 우선 배정 대상: 마감 텃밭 지원자에도 고르게 들어가도록 지정 (g06 3명, g03 2명, 나머지 7명)
  const idxOf = (g: string) => firstChoices.map((c, i) => (c === g ? i : -1)).filter((i) => i >= 0);
  const prioIdx = [...idxOf('g06').slice(0, 3), ...idxOf('g03').slice(0, 2)];
  for (let i = 0; prioIdx.length < 12; i++) if (!prioIdx.includes(i)) prioIdx.push(i);
  const proxyIdx = new Set(prioIdx.filter((_, k) => k >= 8 && k < 11)); // 고령 신청자 3명은 관리자 대리 신청

  applicantIds.forEach((uid, i) => {
    const choices = [firstChoices[i]];
    const wanted = firstChoices[i] === 'g11' || firstChoices[i] === 'g12' ? 1 : 1 + Math.floor(rng() * 3);
    const pool = closedFall.has(firstChoices[i]) ? closedPool : openPool;
    while (choices.length < wanted) {
      const rest = pool.filter((c) => !choices.includes(c));
      if (rest.length === 0) break;
      choices.push(pick(rest, rng));
    }
    const p = prioIdx.indexOf(i);
    const kind = p >= 0 ? priorityKinds[p] : null;
    const user = users.find((u) => u.id === uid)!;
    if (kind) user.priorityTypes = [kind];
    if (kind === '노인') user.dong = pick(DONGS, rng);
    applications.push({
      id: `app_f_${String(i + 1).padStart(3, '0')}`,
      userId: uid,
      recruitmentSeason: '2026-가을',
      choices,
      priorityType: kind ?? '없음',
      priorityVerified: kind ? p < 8 && p !== 4 : false, // p=4(g03 지원자)는 확인 전 — 추첨 전 확인 처리 시연용
      residenceVerified: true,
      consentAt: `2026-09-${String(1 + (i % 14)).padStart(2, '0')}`,
      status: closedFall.has(choices[0]) ? '추첨대기' : '접수',
      assignedGardenId: null,
      waitlistNo: null,
      appliedBy: proxyIdx.has(i) ? '관리자대리' : '본인',
    });
  });

  // 봄 시즌 이력: 이용자 30명은 수락, 신청자 8명은 g06 낙첨
  const spring = (id: string, userId: string, gardenId: string, status: Application['status']): Application => ({
    id, userId, recruitmentSeason: '2026-봄', choices: [gardenId], priorityType: '없음', priorityVerified: false,
    residenceVerified: true, consentAt: '2026-02-20', status,
    assignedGardenId: status === '수락' ? gardenId : null, waitlistNo: null, appliedBy: '본인',
  });
  for (const [gid, hs] of Object.entries(holdersByGarden)) {
    hs.forEach((uid) => applications.push(spring(`app_s_${uid}`, uid, gid, '수락')));
  }
  applicantIds.slice(0, 8).forEach((uid, i) => applications.push(spring(`app_s_lost${i + 1}`, uid, 'g06', '낙첨')));

  // ───────── 봄 추첨 감사 로그 ─────────
  const drawLogs: DrawLog[] = Object.entries(holdersByGarden).map(([gid, hs], i) => {
    const lost = gid === 'g06' ? applicantIds.slice(0, 8) : [];
    const rows: DrawResultRow[] = [
      ...hs.map((uid) => ({ applicationId: `app_s_${uid}`, userId: uid, result: '당첨' as const, group: '일반' as const, choiceRank: 1 })),
      ...lost.map((uid, k) => ({ applicationId: `app_s_lost${k + 1}`, userId: uid, result: '낙첨' as const, group: '일반' as const, choiceRank: 1 })),
    ];
    return {
      id: `dl_2026s_${gid}`,
      gardenId: gid,
      recruitmentSeason: '2026-봄' as SeasonKey,
      executedAt: '2026-03-20T10:00',
      executedBy: 'u_admin1',
      applicantCount: hs.length + lost.length,
      plotCount: hs.length,
      seed: 20260320 + i,
      priorityGroupCount: 0,
      note: lost.length ? undefined : '무추첨 전원 배정',
      groupId: `grp_2026s_${gid}`,
      status: '확정' as const,
      confirmedAt: '2026-03-20T11:00',
      resultSnapshot: rows,
    };
  });

  // ───────── 공지 · 알림 ─────────
  const notices: Notice[] = [
    { id: 'n1', title: '2026년 가을 텃밭 분양 신청 안내', body: '가을 시즌 신청은 2026.08.24부터 텃밭별 마감일까지입니다. 시흥시민만 신청할 수 있으며, 지망은 최대 3곳까지 고를 수 있습니다. 분양은 추첨으로 결정됩니다.', audience: '전체', createdAt: '2026-08-24', pinned: true, authorId: 'u_admin1' },
    { id: 'n2', title: '도시농업위원회 2026년 하반기 정례회의 일정 안내', body: '2026.10.15(목) 14:00 정례회의에서 텃밭 지정 안건을 심의합니다. 등록을 신청하신 제공자께서는 정례회의 일정에 따라 심의까지 시일이 걸릴 수 있음을 양해해 주세요.', audience: '제공자', createdAt: '2026-09-10', authorId: 'u_admin1' },
    { id: 'n3', title: '텃밭 이용 수칙과 경고 제도 안내', body: '미경작 점검 결과에 따라 경고가 부여되며, 경고 3회가 누적되면 구획이 회수됩니다. 사유와 이력은 “내 텃밭”에서 확인할 수 있습니다.', audience: '이용자', createdAt: '2026-08-24', authorId: 'u_admin1' },
    { id: 'n4', title: '가을 추첨 및 당첨자 발표 일정', body: '모집이 마감된 텃밭은 2026.09.22, 그 밖의 텃밭은 2026.10.06에 추첨합니다. 당첨 후 5일 안에 수락하지 않으면 대기자에게 승계됩니다.', audience: '전체', createdAt: '2026-09-16', authorId: 'u_admin1' },
  ];
  const notifications: NotificationLog[] = [
    { id: 'nt1', noticeId: 'n1', channel: '앱 알림', recipientCount: 63, message: '가을 텃밭 분양 신청이 시작되었습니다.', sentAt: '2026-08-24T09:00' },
    { id: 'nt2', noticeId: 'n4', channel: '문자(모의)', recipientCount: 31, message: '가을 추첨 일정을 안내드립니다.', sentAt: '2026-09-16T10:30' },
    { id: 'nt3', noticeId: 'n2', channel: '앱 알림', recipientCount: 4, message: '위원회 하반기 정례회의 일정 안내', sentAt: '2026-09-10T09:00' },
  ];

  return {
    meta: { version: DB_VERSION, today: DEMO_TODAY },
    session: { role: 'citizen', userId: DEMO_ROLES.citizen.defaultUserId },
    settings: structuredClone(DEFAULT_POLICY),
    users,
    gardens,
    recruitments,
    plots,
    applications,
    warnings,
    drawLogs,
    successions: [],
    members,
    meetings,
    agendas,
    votes: [],
    notices,
    notifications,
  };
}
