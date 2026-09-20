// 날짜는 문자열(YYYY-MM-DD 또는 YYYY-MM-DDTHH:mm)로 다루고, 시간대 문제를 피하려고 UTC로 계산한다.

const pad = (n: number) => String(n).padStart(2, '0');

function parts(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return { y, m, d };
}

/** 2026-09-20 → 2026.09.20 */
export function formatDate(iso: string): string {
  const { y, m, d } = parts(iso);
  return `${y}.${pad(m)}.${pad(d)}`;
}

/** 2026-10-15T14:00 → 2026.10.15 14:00 */
export function formatDateTime(iso: string): string {
  const time = iso.length > 10 ? ` ${iso.slice(11, 16)}` : '';
  return `${formatDate(iso)}${time}`;
}

/** 30000 → 30,000원 */
export function formatKRW(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

export function feeLabel(fee: number): string {
  return fee === 0 ? '무료' : `${formatKRW(fee)}/시즌`;
}

const utc = (iso: string) => {
  const { y, m, d } = parts(iso);
  return Date.UTC(y, m - 1, d);
};

/** to - from (일). 미래면 양수. */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((utc(toIso) - utc(fromIso)) / 86400000);
}

export function addDays(iso: string, days: number): string {
  const t = new Date(utc(iso) + days * 86400000);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** D-5 / D-Day / D+3 */
export function dDayLabel(targetIso: string, todayIso: string): string {
  const diff = daysBetween(todayIso, targetIso);
  if (diff === 0) return 'D-Day';
  return diff > 0 ? `D-${diff}` : `D+${-diff}`;
}

/** 개월 더하기. 말일을 넘기면 그 달 말일로 맞춘다 (1/31 + 1개월 = 2/28). */
export function addMonths(iso: string, months: number): string {
  const { y, m, d } = parts(iso);
  const total = m - 1 + months;
  const year = y + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return `${year}-${pad(month + 1)}-${pad(Math.min(d, last))}`;
}

/** 이용 기간의 마지막 날: 시작일 + N개월 - 1일 (2026-04-01 + 8개월 → 2026-11-30) */
export const usageEndOf = (startIso: string, months: number): string => addDays(addMonths(startIso, months), -1);
