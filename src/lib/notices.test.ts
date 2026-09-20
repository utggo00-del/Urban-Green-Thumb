import { beforeEach, describe, expect, it } from 'vitest';
import { buildSeed } from '../data/seed';
import type { Db } from '../types';
import { deleteNotice, noticeRecipients, publishNotice, setPinned } from './notices';
import type { Res } from './workflow';

const ADMIN = 'u_admin1';
const okValue = <T>(r: Res<T>): T => {
  expect(r.ok, r.ok ? '' : (r as { error: string }).error).toBe(true);
  return (r as { value: T }).value;
};
const errOf = (r: Res<unknown>): string => {
  expect(r.ok).toBe(false);
  return (r as { error: string }).error;
};

let db: Db;
beforeEach(() => {
  db = buildSeed();
});

describe('수신자 수', () => {
  it('제공자: 소유자 계정(시 기관 계정 제외)', () => {
    expect(noticeRecipients(db, '제공자')).toBe(db.users.filter((u) => u.role === '제공자' && u.id !== 'u_o_city').length);
    expect(noticeRecipients(db, '제공자')).toBe(8);
  });
  it('이용자: 구획을 이용 중인 사람 (봄 이용자 30명)', () => {
    expect(noticeRecipients(db, '이용자')).toBe(30);
  });
  it('전체: 시민·제공자 계정 전체', () => {
    const n = db.users.filter((u) => (u.role === '시민' || u.role === '제공자') && u.id !== 'u_o_city').length;
    expect(noticeRecipients(db, '전체')).toBe(n);
    expect(n).toBeGreaterThan(noticeRecipients(db, '이용자'));
  });
});

describe('공지 게시와 알림 발송(모의)', () => {
  it('공지를 게시하면 시민 화면에서 볼 수 있고, 선택한 채널마다 발송 내역이 남는다', () => {
    const before = db.notifications.length;
    const id = okValue(publishNotice(db, { title: '10월 텃밭 정리 안내', body: '수확이 끝난 구획은 10월 말까지 정리해 주세요.', audience: '이용자', pinned: true, channels: ['앱 알림', '문자(모의)'] }, ADMIN));
    expect(db.notices.find((n) => n.id === id)).toMatchObject({ title: '10월 텃밭 정리 안내', audience: '이용자', pinned: true, createdAt: '2026-09-20', authorId: ADMIN });
    const logs = db.notifications.slice(before);
    expect(logs.map((l) => l.channel)).toEqual(['앱 알림', '문자(모의)']);
    for (const l of logs) expect(l).toMatchObject({ noticeId: id, recipientCount: 30, message: '10월 텃밭 정리 안내' });
  });

  it('채널을 고르지 않으면 공지만 게시하고 발송 내역은 없다', () => {
    const before = db.notifications.length;
    okValue(publishNotice(db, { title: '공지만 게시', body: '알림은 보내지 않아요.', audience: '전체' }, ADMIN));
    expect(db.notifications).toHaveLength(before);
  });

  it('같은 채널을 중복 선택해도 한 번만 발송한다, 공지 id는 겹치지 않는다', () => {
    const a = okValue(publishNotice(db, { title: '중복 채널', body: '내용입니다 내용', audience: '전체', channels: ['앱 알림', '앱 알림'] }, ADMIN));
    expect(db.notifications.filter((l) => l.noticeId === a)).toHaveLength(1);
    const b = okValue(publishNotice(db, { title: '두 번째', body: '내용입니다 내용', audience: '전체' }, ADMIN));
    expect(new Set(db.notices.map((n) => n.id)).size).toBe(db.notices.length);
    expect(a).not.toBe(b);
  });

  it('제목·내용·대상 검증, 관리자만 가능', () => {
    const n = db.notices.length;
    expect(errOf(publishNotice(db, { title: '가', body: '충분히 긴 내용', audience: '전체' }, ADMIN))).toContain('제목');
    expect(errOf(publishNotice(db, { title: '가'.repeat(61), body: '충분히 긴 내용', audience: '전체' }, ADMIN))).toContain('60자');
    expect(errOf(publishNotice(db, { title: '정상 제목', body: '짧음', audience: '전체' }, ADMIN))).toContain('내용');
    expect(errOf(publishNotice(db, { title: '정상 제목', body: '충분히 긴 내용', audience: '없는대상' as never }, ADMIN))).toContain('대상');
    expect(errOf(publishNotice(db, { title: '정상 제목', body: '충분히 긴 내용', audience: '전체' }, 'u_c001'))).toContain('관리자');
    expect(errOf(publishNotice(db, { title: '정상 제목', body: '충분히 긴 내용', audience: '전체' }, 'u_member05'))).toContain('관리자');
    expect(db.notices).toHaveLength(n);
  });

  it('고정 토글과 삭제 (삭제해도 발송 내역은 감사 기록으로 남는다)', () => {
    const id = okValue(publishNotice(db, { title: '삭제할 공지', body: '내용입니다 내용', audience: '전체', channels: ['앱 알림'] }, ADMIN));
    okValue(setPinned(db, id, true, ADMIN));
    expect(db.notices.find((n) => n.id === id)?.pinned).toBe(true);
    okValue(setPinned(db, id, false, ADMIN));
    expect(db.notices.find((n) => n.id === id)?.pinned).toBe(false);
    okValue(deleteNotice(db, id, ADMIN));
    expect(db.notices.some((n) => n.id === id)).toBe(false);
    expect(db.notifications.some((l) => l.noticeId === id)).toBe(true);
    expect(errOf(deleteNotice(db, id, ADMIN))).toContain('찾을 수 없');
    expect(errOf(setPinned(db, 'nope', true, ADMIN))).toContain('찾을 수 없');
    expect(errOf(deleteNotice(db, 'n1', 'u_c001'))).toContain('관리자');
  });
});
