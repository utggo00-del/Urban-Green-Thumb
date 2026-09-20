// 텃밭 등록 신청 입력 검증과 Garden 생성 (SPEC 5.6). 공공·민간·개인 공통 절차.
import { DEFAULT_RULES_TEXT } from '../data/rules';
import { DONG_CENTERS } from '../config';
import type { BankAccount, Db, FacilityKey, Garden, OrdinanceType, OwnerKind } from '../types';

export interface RegistrationInput {
  ownerId: string;
  type: OwnerKind;
  ordinanceType: OrdinanceType;
  name: string;
  address: string;
  dong: string;
  totalAreaM2: number;
  plotCount: number;
  plotAreaM2: number;
  facilities: FacilityKey[];
  rules: string;
  /** 원/시즌, 0이면 무료 */
  fee: number;
  feeAccount?: BankAccount;
  /** 민간 텃밭만 */
  isWeekendFarmOperator?: boolean;
  /** 최소 제공 기간(개월) */
  seasonMinTerm: number;
  documents: string[];
  /** 소유자 동의서 파일명 (조례 제11조, 필수) */
  ownerConsentDoc: string;
}

export type FieldErrors = Partial<Record<keyof RegistrationInput, string>>;

const isInt = (n: number) => Number.isInteger(n);

/** 필드별 오류. 비어 있으면 통과. */
export function validateRegistration(i: RegistrationInput): FieldErrors {
  const e: FieldErrors = {};
  if (i.name.trim().length < 2) e.name = '텃밭 이름을 2자 이상 입력해 주세요.';
  if (!i.address.trim()) e.address = '주소를 입력해 주세요.';
  if (!i.dong) e.dong = '행정동을 선택해 주세요.';
  if (!isInt(i.plotCount) || i.plotCount < 1) e.plotCount = '구획 수는 1 이상의 정수로 입력해 주세요.';
  if (!(i.plotAreaM2 > 0)) e.plotAreaM2 = '구획 1개의 면적(㎡)을 입력해 주세요.';
  if (!(i.totalAreaM2 > 0)) e.totalAreaM2 = '전체 면적(㎡)을 입력해 주세요.';
  else if (!e.plotCount && !e.plotAreaM2 && i.totalAreaM2 < i.plotCount * i.plotAreaM2) {
    e.totalAreaM2 = `전체 면적이 구획 면적의 합(${Math.round(i.plotCount * i.plotAreaM2)}㎡)보다 작을 수 없어요.`;
  }
  if (!isInt(i.fee) || i.fee < 0) e.fee = '이용료는 0 이상의 정수로 입력해 주세요. (무료는 0)';
  if (!isInt(i.seasonMinTerm) || i.seasonMinTerm < 1) e.seasonMinTerm = '최소 제공 기간은 1개월 이상으로 입력해 주세요.';
  if (i.type !== '공공' && i.fee > 0) {
    const a = i.feeAccount;
    if (!a || !a.bank.trim() || !a.number.trim() || !a.holder.trim()) e.feeAccount = '이용료를 받을 계좌(은행·계좌번호·예금주)를 모두 입력해 주세요.';
  }
  if (i.documents.length === 0) e.documents = '토지 서류를 1개 이상 첨부해 주세요.';
  if (!i.ownerConsentDoc) e.ownerConsentDoc = '소유자 동의서를 첨부해 주세요. (조례 제11조, 필수)';
  return e;
}

export const hasErrors = (e: FieldErrors) => Object.keys(e).length > 0;

/** 지도 위치 대신 행정동 중심 좌표에 살짝 흩뿌려 마커가 겹치지 않게 한다. */
function locate(db: Db, dong: string): [number, number] {
  const [lat, lng] = DONG_CENTERS[dong] ?? [37.38, 126.8];
  const n = db.gardens.length;
  const round = (x: number) => Math.round(x * 1e5) / 1e5;
  return [round(lat + (((n * 37) % 100) - 50) / 12000), round(lng + (((n * 53) % 100) - 50) / 12000)];
}

export function nextGardenId(db: Db): string {
  let n = db.gardens.length + 1;
  while (db.gardens.some((g) => g.id === `g${String(n).padStart(2, '0')}`)) n++;
  return `g${String(n).padStart(2, '0')}`;
}

/** 검증을 통과한 입력으로 `검수중` 상태의 텃밭을 만든다. */
export function buildGarden(db: Db, i: RegistrationInput): Garden {
  const [lat, lng] = locate(db, i.dong);
  const g: Garden = {
    id: nextGardenId(db),
    name: i.name.trim(),
    type: i.type,
    ordinanceType: i.ordinanceType,
    ownerId: i.ownerId,
    address: i.address.trim(),
    dong: i.dong,
    lat,
    lng,
    totalAreaM2: i.totalAreaM2,
    plotCount: i.plotCount,
    plotAreaM2: i.plotAreaM2,
    facilities: i.facilities,
    rules: i.rules.trim() || DEFAULT_RULES_TEXT,
    fee: i.fee,
    status: '검수중',
    documents: i.documents,
    ownerConsentDoc: i.ownerConsentDoc,
    seasonMinTerm: i.seasonMinTerm,
    createdAt: db.meta.today,
    history: [{ at: db.meta.today, label: '등록 신청' }],
  };
  if (i.type !== '공공' && i.fee > 0 && i.feeAccount) g.feeAccount = { ...i.feeAccount };
  if (i.type === '민간') g.isWeekendFarmOperator = !!i.isWeekendFarmOperator;
  return g;
}
