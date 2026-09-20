import type { StackSeries } from './Bars';

/**
 * 신청 결과 구성 — 색은 검증된 범주형 팔레트의 슬롯 순서(파랑·주황·청록)를 그대로 쓰고,
 * 강조하지 않을 “추첨 전”만 회색으로 둔다. 조각 안 글자는 대비가 큰 쪽(흰색/짙은 잉크)을 고른다.
 */
export const OUTCOME_SERIES: StackSeries[] = [
  // 파랑 위 흰 글자는 4.4:1이라 조각 안 값 표기를 생략한다 (값은 막대 아래 글자·표 보기에 있다)
  { key: 'assigned', label: '배정', color: 'var(--color-viz-1)' },
  { key: 'waiting', label: '대기', color: 'var(--color-viz-2)', ink: '#0b0b0b' },
  { key: 'lost', label: '낙첨', color: 'var(--color-viz-3)', ink: '#0b0b0b' },
  { key: 'pending', label: '추첨 전', color: 'var(--color-viz-neutral)', ink: '#0b0b0b' },
];

/** 텃밭 유형은 통계 화면 어디서나 같은 색을 쓴다 (색은 항목을 따라가고 순위를 따라가지 않는다) */
export const OWNER_COLOR = { 공공: 'var(--color-viz-1)', 민간: 'var(--color-viz-2)', 개인: 'var(--color-viz-3)' } as const;
