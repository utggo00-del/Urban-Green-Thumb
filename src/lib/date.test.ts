import { describe, expect, it } from 'vitest';
import { addDays, addMonths, usageEndOf, dDayLabel, daysBetween, feeLabel, formatDate, formatDateTime, formatKRW } from './date';

describe('date / money format', () => {
  it('날짜는 2026.09.20 형식', () => {
    expect(formatDate('2026-09-20')).toBe('2026.09.20');
    expect(formatDateTime('2026-10-15T14:00')).toBe('2026.10.15 14:00');
  });
  it('금액은 30,000원 형식, 0원은 무료', () => {
    expect(formatKRW(30000)).toBe('30,000원');
    expect(feeLabel(0)).toBe('무료');
    expect(feeLabel(60000)).toBe('60,000원/시즌');
  });
  it('D-day 계산', () => {
    expect(dDayLabel('2026-10-15', '2026-09-20')).toBe('D-25');
    expect(dDayLabel('2026-09-20', '2026-09-20')).toBe('D-Day');
    expect(dDayLabel('2026-09-18', '2026-09-20')).toBe('D+2');
    expect(daysBetween('2026-09-20', '2026-10-15')).toBe(25);
    expect(addDays('2026-09-28', 5)).toBe('2026-10-03');
  });
  it('개월 더하기와 이용 기간', () => {
    expect(addMonths('2026-04-01', 8)).toBe('2026-12-01');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28'); // 말일 보정
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29'); // 윤년
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15'); // 해를 넘김
    expect(usageEndOf('2026-04-01', 8)).toBe('2026-11-30');
    expect(usageEndOf('2026-09-25', 8)).toBe('2027-05-24');
  });
});
