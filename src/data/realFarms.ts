// 시흥시에서 실제로 운영 중인 텃밭(주말농장) 정보.
// 출처: 전국주말농장(jumalfarm.com) 시흥시 페이지 — 네이버 플레이스·경기도/시흥시 공공데이터를 모은 정보. 2026-10-30 확인.
// 앱의 가상 텃밭(seed.ts)과 달리 저장소(localStorage)에 넣지 않고, 위원회 심의·모집·추첨·경고 흐름에도 들어가지 않는다.
// 수확 체험만 하는 농장은 빼고, 텃밭을 분양하는 곳만 담았다. 같은 주소의 중복 항목(한마음이랑)은 하나로 합쳤다.

export type RealFarmOperator = '공영' | '민간' | '정보 없음';

export interface RealFarm {
  id: string;
  name: string;
  operator: RealFarmOperator;
  /** 운영 주체 이름 (출처에 있을 때만) */
  operatorName?: string;
  /** 행정동 (출처에 없으면 undefined) */
  dong?: string;
  address: string;
  lat: number;
  lng: number;
  /** 한 구획 넓이 (평) — 출처에 없으면 undefined */
  plotPyeong?: number;
  plotM2?: number;
  /** 분양가 안내 문구 — 출처에 없으면 undefined ("분양가 문의"로 표시) */
  price?: string;
  /** 카드에 쓰는 짧은 분양가 (예: "10만원") */
  priceShort?: string;
  /** 신청 방법 */
  apply?: string;
  /** 출처에 적힌 경작·운영 시기 */
  period?: string;
  phone?: string;
  homepage?: string;
  amenities: string[];
  /** 한두 문장 소개 (출처 내용을 요약) */
  summary: string;
  /** 따로 알릴 점 (예: 올해 예약 마감) */
  note?: string;
  sourceUrl: string;
}

export const REAL_FARM_SOURCE = {
  name: '전국주말농장(jumalfarm.com)',
  url: 'https://jumalfarm.com/region/%EA%B2%BD%EA%B8%B0/%EC%8B%9C%ED%9D%A5%EC%8B%9C/',
  basis: '네이버 플레이스 · 경기도/시흥시 공공데이터 기준',
  checkedAt: '2026-10-30',
};

const SRC = 'https://jumalfarm.com/farm/';
/** 시흥시 공공데이터에 함께 등록된 문의 전화 */
const SIHEUNG_TEL = '031-310-6201';

export const REAL_FARMS: RealFarm[] = [
  // ───────── 공영 3곳 ─────────
  {
    id: 'rf01', name: '시흥시공영도시농업농장', operator: '공영', operatorName: '시흥시농업기술센터',
    dong: '월곶동', address: '경기도 시흥시 월곶동 995', lat: 37.3887954, lng: 126.7416077,
    plotPyeong: 4.8, plotM2: 16, apply: '방문 신청', amenities: [],
    summary: '시흥시농업기술센터가 운영하는 월곶동의 공영 텃밭이에요.',
    sourceUrl: `${SRC}pub-67515b2558-%EC%8B%9C%ED%9D%A5%EC%8B%9C%EA%B3%B5%EC%98%81%EB%8F%84%EC%8B%9C%EB%86%8D%EC%97%85%EB%86%8D%EC%9E%A5/`,
  },
  {
    id: 'rf02', name: '함줄도시농업공원', operator: '공영', operatorName: '시흥시농업기술센터',
    address: '경기도 시흥시 봉화로 13', lat: 37.3681626, lng: 126.7358091,
    plotPyeong: 4.8, plotM2: 16, apply: '방문 신청', amenities: [],
    summary: '시흥시농업기술센터가 운영하는 도시농업공원 안의 공영 텃밭이에요.',
    sourceUrl: `${SRC}pub-b6910dfe00-%ED%95%A8%EC%A4%84%EB%8F%84%EC%8B%9C%EB%86%8D%EC%97%85%EA%B3%B5%EC%9B%90/`,
  },
  {
    id: 'rf03', name: '안현동 친환경농장', operator: '공영', operatorName: '서울시청(출처 표기)',
    dong: '안현동', address: '경기도 시흥시 안현동 35', lat: 37.4323406, lng: 126.8195854,
    apply: '홈페이지 신청', period: '수확·체험 5월 ~ 7월', phone: '02-2619-0123',
    amenities: ['주차장', '화장실', '물 공급', '쉼터'],
    summary: '양지산 자락의 친환경 주말농장이에요. 지하수로 작물을 키우고 구획 단위로 분양해요.',
    sourceUrl: `${SRC}1514656896-%EC%95%88%ED%98%84%EB%8F%99-%EC%B9%9C%ED%99%98%EA%B2%BD%EB%86%8D%EC%9E%A5/`,
  },
  // ───────── 민간 ─────────
  {
    id: 'rf04', name: '평화농장', operator: '민간', operatorName: '평화농장',
    dong: '신천동', address: '경기도 시흥시 신천동 252-3', lat: 37.4344103, lng: 126.7805684,
    plotPyeong: 8, plotM2: 26, price: '일반 구획 100,000원 · 고구마 전용(4평) 50,000원 (2025년 기준)', priceShort: '10만원',
    apply: '블로그 안내에 따라 예약 연락', period: '경작 3월 ~', homepage: 'https://blog.naver.com/ys9074',
    amenities: ['농기구'],
    summary: '일반 분양 구획과 고구마 전용 구획이 있고, 감자·고구마 캐기와 포도따기 체험도 운영해요.',
    sourceUrl: `${SRC}19713356-%ED%8F%89%ED%99%94%EB%86%8D%EC%9E%A5/`,
  },
  {
    id: 'rf05', name: '계수동주말농장', operator: '민간',
    dong: '계수동', address: '경기도 시흥시 계수동', lat: 37.4566054, lng: 126.8177623,
    plotPyeong: 5, plotM2: 17, apply: '전화로 대기자 명단 등록', period: '경작 4월 ~ 5월',
    phone: '031-383-6259', homepage: 'https://band.us/@shm1106', amenities: ['주차장', '퇴비 제공'],
    summary: '5평 단위 구획형 주말농장이에요. 대기자 명단에 올린 뒤 배정받는 방식이에요.',
    sourceUrl: `${SRC}706946389-%EA%B3%84%EC%88%98%EB%8F%99%EC%A3%BC%EB%A7%90%EB%86%8D%EC%9E%A5/`,
  },
  {
    id: 'rf06', name: '오성주말농장 (계수동 314-9)', operator: '민간',
    dong: '계수동', address: '경기도 시흥시 계수동 314-9', lat: 37.456663, lng: 126.805442,
    plotPyeong: 20, plotM2: 66, apply: '1년 단위 계약', period: '경작 3월 ~ 11월', amenities: [],
    summary: '1년 단위로 구획을 계약해 작물을 키우는 주말농장이에요. 산 위에 있어 진입로가 험해요.',
    sourceUrl: `${SRC}21829558-%EC%98%A4%EC%84%B1%EC%A3%BC%EB%A7%90%EB%86%8D%EC%9E%A5/`,
  },
  {
    id: 'rf07', name: '시흥 갯골농장', operator: '민간',
    dong: '장현동', address: '경기도 시흥시 장현동 109-4', lat: 37.3918348, lng: 126.7908475,
    apply: '농장에 연락 후 신청', homepage: 'https://gaegolfarm.modoo.at', amenities: [],
    summary: '장곡천 근처 농장으로, 제철 채소 직거래와 함께 주말농장을 분양해요.',
    sourceUrl: `${SRC}1738636758-%EC%8B%9C%ED%9D%A5-%EA%B0%AF%EA%B3%A8%EB%86%8D%EC%9E%A5/`,
  },
  {
    id: 'rf08', name: '그루터기 주말농장', operator: '민간', operatorName: '민간단체',
    address: '경기도 시흥시 봉화로144번길 107-40', lat: 37.3559855, lng: 126.7414655,
    plotPyeong: 5.1, plotM2: 17, apply: '홈페이지·네이버 카페 등', amenities: [],
    summary: '민간단체가 운영하는 텃밭이에요. (경기도 공공데이터 등록)',
    sourceUrl: `${SRC}pub-8fa021309e-%EA%B7%B8%EB%A3%A8%ED%84%B0%EA%B8%B0-%EC%A3%BC%EB%A7%90%EB%86%8D%EC%9E%A5/`,
  },
  {
    id: 'rf09', name: '한마음이랑 농장', operator: '민간', operatorName: '민간단체',
    dong: '조남동', address: '경기도 시흥시 조남동 47', lat: 37.3808218, lng: 126.8703491,
    plotPyeong: 7, plotM2: 23, apply: '홈페이지·네이버 카페 등', period: '1월 ~ 3월 (공공데이터 표기)',
    phone: SIHEUNG_TEL, amenities: [],
    summary: '민간단체가 운영하는 조남동 텃밭이에요. (경기도·시흥시 공공데이터 등록)',
    sourceUrl: `${SRC}pub-461f0c7540-%ED%95%9C%EB%A7%88%EC%9D%8C%EC%9D%B4%EB%9E%91/`,
  },
  // ───────── 운영 주체 정보 없음 ─────────
  {
    id: 'rf10', name: '큰오빠농장', operator: '정보 없음',
    dong: '미산동', address: '경기도 시흥시 미산동 635', lat: 37.4164371, lng: 126.7832923,
    homepage: 'https://cafe.naver.com/bigbrotherfarm', period: '매일 10:00 ~ 17:00 운영', amenities: ['주차장'],
    summary: '미산동의 주말농장이에요. 구획 가격과 신청 방법은 카페에서 확인해야 해요.',
    sourceUrl: `${SRC}36504961-%ED%81%B0%EC%98%A4%EB%B9%A0%EB%86%8D%EC%9E%A5/`,
  },
  {
    id: 'rf11', name: '민호농장', operator: '정보 없음',
    dong: '방산동', address: '경기도 시흥시 방산동 246-2', lat: 37.4197379, lng: 126.7648372, amenities: [],
    summary: '방산동의 주말농장이에요. 면적·가격·분양 정보는 출처에 없어요.',
    sourceUrl: `${SRC}1121272782-%EB%AF%BC%ED%98%B8%EB%86%8D%EC%9E%A5/`,
  },
  {
    id: 'rf12', name: '남매 주말농장', operator: '정보 없음',
    dong: '계수동', address: '경기도 시흥시 계수동 427', lat: 37.4556325, lng: 126.8001406,
    apply: '전화 문의', phone: '0507-1317-7337', amenities: [],
    summary: '외곽순환고속도로 시흥IC 근처의 주말농장이에요.',
    note: '올해는 예약이 마감되었다고 안내돼 있어요.',
    sourceUrl: `${SRC}1920727246-%EB%82%A8%EB%A7%A4-%EC%A3%BC%EB%A7%90%EB%86%8D%EC%9E%A5/`,
  },
  {
    id: 'rf13', name: '오성주말농장 (계수동 384)', operator: '정보 없음',
    dong: '계수동', address: '경기도 시흥시 계수동 384', lat: 37.4601225, lng: 126.7986582, amenities: [],
    summary: '네이버 플레이스에 주말농장으로 등록된 곳이에요. 운영 방식과 가격은 출처에 없어요.',
    sourceUrl: `${SRC}1008828993-%EC%98%A4%EC%84%B1%EC%A3%BC%EB%A7%90%EB%86%8D%EC%9E%A5/`,
  },
  {
    id: 'rf14', name: '목감주말농장', operator: '정보 없음',
    dong: '목감동', address: '경기도 시흥시 목감동 46', lat: 37.4005102, lng: 126.8710108,
    plotPyeong: 10, plotM2: 33, apply: '네이버 카페에서 확인', homepage: 'https://cafe.naver.com/nongjang46', amenities: ['주차장'],
    summary: '서해안고속도로 목감IC 바로 옆 주말농장이에요. 1구좌가 약 10평이에요.',
    sourceUrl: `${SRC}1367869174-%EB%AA%A9%EA%B0%90%EC%A3%BC%EB%A7%90%EB%86%8D%EC%9E%A5/`,
  },
  {
    id: 'rf15', name: '초원농장', operator: '정보 없음',
    dong: '과림동', address: '경기도 시흥시 금오로309번길 39-1', lat: 37.4300786, lng: 126.8310577, amenities: [],
    summary: '네이버 플레이스에 주말농장으로 등록된 곳이에요. 분양 조건과 가격은 출처에 없어요.',
    sourceUrl: `${SRC}13431611-%EC%B4%88%EC%9B%90%EB%86%8D%EC%9E%A5/`,
  },
  {
    id: 'rf16', name: '복수초치유농장', operator: '정보 없음',
    dong: '광석동', address: '경기도 시흥시 광석동 168-1, 169', lat: 37.38144197, lng: 126.8195385,
    period: '1월 ~ 3월 (공공데이터 표기)', phone: SIHEUNG_TEL, amenities: [],
    summary: '광석동의 텃밭이에요. (시흥시 공공데이터 등록)',
    sourceUrl: `${SRC}pub-e43f37496f-%EB%B3%B5%EC%88%98%EC%B4%88%EC%B9%98%EC%9C%A0%EB%86%8D%EC%9E%A5/`,
  },
  {
    id: 'rf17', name: '아파트주말농장', operator: '정보 없음',
    dong: '정왕동', address: '경기도 시흥시 정왕동 49-52', lat: 37.36595065, lng: 126.741468,
    period: '1월 ~ 3월 (공공데이터 표기)', phone: SIHEUNG_TEL, amenities: [],
    summary: '정왕동의 텃밭이에요. (시흥시 공공데이터 등록)',
    sourceUrl: `${SRC}pub-4a047e01ed-%EC%95%84%ED%8C%8C%ED%8A%B8%EC%A3%BC%EB%A7%90%EB%86%8D%EC%9E%A5/`,
  },
  {
    id: 'rf18', name: '환타스틱 팜', operator: '정보 없음',
    dong: '신천동', address: '경기도 시흥시 신천동 434-4', lat: 37.44087266, lng: 126.7775634,
    period: '1월 ~ 3월 (공공데이터 표기)', phone: SIHEUNG_TEL, amenities: [],
    summary: '신천동의 텃밭이에요. (시흥시 공공데이터 등록)',
    sourceUrl: `${SRC}pub-ea8a8bcb7e-%ED%99%98%ED%83%80%EC%8A%A4%ED%8B%B1-%ED%8C%9C/`,
  },
  {
    id: 'rf19', name: '신현동 새마을 주말농장', operator: '정보 없음',
    dong: '포동', address: '경기도 시흥시 포동 14-3, 19-17', lat: 37.40584557, lng: 126.7842315,
    period: '1월 ~ 2월 (공공데이터 표기)', phone: SIHEUNG_TEL, amenities: [],
    summary: '포동의 새마을 주말농장이에요. (시흥시 공공데이터 등록)',
    sourceUrl: `${SRC}pub-89aca58bcc-%EC%8B%A0%ED%98%84%EB%8F%99-%EC%83%88%EB%A7%88%EC%9D%84-%EC%A3%BC%EB%A7%90%EB%86%8D%EC%9E%A5/`,
  },
];

export const getRealFarm = (id: string) => REAL_FARMS.find((f) => f.id === id);

export const NO_DONG = '동 정보 없음';
export const realFarmDong = (f: RealFarm) => f.dong ?? NO_DONG;

/** 네이버 지도 검색 링크 (주소 기준) */
export const naverMapUrl = (f: RealFarm) => `https://map.naver.com/p/search/${encodeURIComponent(f.address)}`;
