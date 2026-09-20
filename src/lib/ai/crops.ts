// 추천 작물 정보(일반적인 재배 상식 수준의 요약). 정확한 시기·방법은 지역과 해마다 달라지므로
// 화면에는 항상 “대략”과 “텃밭지원과·농업기술센터에 문의” 문구를 함께 보여 준다.
import type { SeasonName } from '../../types';

export type CropGroup = '잎채소' | '뿌리채소' | '열매채소' | '김장·양념채소';

export interface Crop {
  id: string;
  name: string;
  group: CropGroup;
  seasons: SeasonName[];
  /** 1 쉬움 · 2 보통 · 3 어려움 */
  difficulty: 1 | 2 | 3;
  /** 대략적인 심는 시기 */
  sow: string;
  /** 대략적인 수확 시기 */
  harvest: string;
  /** 친환경(조례 제3조) 재배 팁 */
  tip: string;
}

export const CROP_GROUPS: CropGroup[] = ['잎채소', '뿌리채소', '열매채소', '김장·양념채소'];

export const CROPS: Crop[] = [
  // 가을
  { id: 'spinach', name: '시금치', group: '잎채소', seasons: ['가을'], difficulty: 1, sow: '9월 하순~10월 초', harvest: '심고 약 5~6주 뒤', tip: '서늘한 날씨를 좋아해요. 씨앗을 촘촘히 뿌렸다면 솎아 주면서 어린잎부터 먹어요.' },
  { id: 'lettuce', name: '상추', group: '잎채소', seasons: ['가을', '봄'], difficulty: 1, sow: '9월(가을), 3~4월(봄)', harvest: '심고 약 4~6주 뒤', tip: '겉잎부터 따서 먹으면 오래 수확할 수 있어요. 한낮 더위에는 물을 자주 주세요.' },
  { id: 'radish-young', name: '열무', group: '뿌리채소', seasons: ['가을', '봄'], difficulty: 1, sow: '9월 초·중순(가을), 4월(봄)', harvest: '심고 약 4주 뒤', tip: '자라는 속도가 빨라 처음 키우는 분께 좋아요. 벌레는 손으로 잡거나 방충망으로 막아요.' },
  { id: 'scallion', name: '쪽파', group: '김장·양념채소', seasons: ['가을'], difficulty: 1, sow: '9월 초·중순', harvest: '심고 약 5~7주 뒤', tip: '알뿌리를 얕게 심고 흙을 살짝 덮어요. 물이 고이지 않게 하세요.' },
  { id: 'garlic', name: '마늘', group: '김장·양념채소', seasons: ['가을'], difficulty: 2, sow: '10월 중순~11월 초', harvest: '이듬해 6월경', tip: '겨울을 나는 작물이에요. 짚이나 낙엽으로 덮어 얼지 않게 해 주세요.' },
  { id: 'cabbage', name: '배추', group: '김장·양념채소', seasons: ['가을'], difficulty: 3, sow: '8월 말~9월 초(모종)', harvest: '심고 약 10주 뒤', tip: '벌레가 많이 꼬여요. 자주 살펴서 손으로 잡아 주고, 모종은 튼튼한 것을 고르세요.' },
  { id: 'carrot', name: '당근', group: '뿌리채소', seasons: ['가을', '봄'], difficulty: 2, sow: '8월 말~9월 초(가을), 3~4월(봄)', harvest: '심고 약 3~4개월 뒤', tip: '싹이 트기까지 흙이 마르지 않게 해 주세요. 솎아 주어야 굵어져요.' },
  // 봄
  { id: 'potato', name: '감자', group: '뿌리채소', seasons: ['봄'], difficulty: 1, sow: '3월 중순~하순', harvest: '심고 약 3개월 뒤(6월)', tip: '씨감자는 눈이 있게 잘라 심어요. 싹이 올라오면 흙을 덮어 북주기를 해 주세요.' },
  { id: 'pea', name: '완두콩', group: '열매채소', seasons: ['봄'], difficulty: 2, sow: '3월', harvest: '5월 말~6월', tip: '덩굴이 타고 오를 지지대를 세워 주세요.' },
  { id: 'tomato', name: '방울토마토', group: '열매채소', seasons: ['봄'], difficulty: 2, sow: '4월 말~5월 초(모종)', harvest: '심고 약 2개월 뒤부터', tip: '곁순을 따 주고 지지대에 묶어 주세요. 물은 흙이 마를 때 한 번에 충분히 주세요.' },
  { id: 'pepper', name: '고추', group: '열매채소', seasons: ['봄'], difficulty: 2, sow: '5월 초(모종)', harvest: '심고 약 2개월 뒤부터', tip: '지지대를 세우고 통풍이 잘 되게 간격을 두고 심어요.' },
  { id: 'cucumber', name: '오이', group: '열매채소', seasons: ['봄'], difficulty: 2, sow: '5월(모종)', harvest: '심고 약 6~7주 뒤', tip: '그물망이나 지지대를 세워 덩굴을 올려 주면 공간을 아낄 수 있어요.' },
  { id: 'sweet-potato', name: '고구마', group: '뿌리채소', seasons: ['봄'], difficulty: 1, sow: '5월(순 심기)', harvest: '10월경', tip: '척박한 땅에서도 잘 자라 손이 덜 가요. 비료를 많이 주면 줄기만 무성해져요.' },
];

export const cropById = (id: string): Crop | undefined => CROPS.find((c) => c.id === id);

export const DIFFICULTY_LABEL = { 1: '쉬움', 2: '보통', 3: '조금 어려움' } as const;
