// 공지 작성과 알림 발송(모의) (SPEC 3.2-8). 실제 문자·알림톡은 발송하지 않고 발송 내역만 남긴다.
import type { Db, Notice, NotificationLog } from '../types';
import { fail, ok, type Res } from './workflow';

const isAdmin = (db: Db, id: string) => db.users.find((u) => u.id === id)?.role === '관리자';
const notAdmin = () => fail('텃밭지원과 관리자만 할 수 있는 작업입니다.');

export const CHANNELS: NotificationLog['channel'][] = ['앱 알림', '문자(모의)'];
export const AUDIENCES: Notice['audience'][] = ['전체', '이용자', '제공자'];

/** 시 소유 텃밭의 기관 계정은 알림 대상이 아니다 */
const isPerson = (u: { id: string; role: string }) => u.id !== 'u_o_city' && (u.role === '시민' || u.role === '제공자');

/** 대상별 수신자 수: 전체(시민·제공자 계정) / 이용자(구획을 배정받았거나 이용 중인 사람) / 제공자(텃밭 소유자) */
export function noticeRecipients(db: Db, audience: Notice['audience']): number {
  if (audience === '전체') return db.users.filter(isPerson).length;
  if (audience === '제공자') return db.users.filter((u) => u.role === '제공자' && isPerson(u)).length;
  return new Set(db.plots.filter((p) => p.userId).map((p) => p.userId)).size;
}

export interface NoticeInput {
  title: string;
  body: string;
  audience: Notice['audience'];
  pinned?: boolean;
  /** 함께 발송할 알림 채널. 비우면 공지만 게시한다. */
  channels?: NotificationLog['channel'][];
}

export function publishNotice(db: Db, input: NoticeInput, byId: string): Res<string> {
  if (!isAdmin(db, byId)) return notAdmin();
  const title = input.title.trim();
  const body = input.body.trim();
  if (title.length < 2) return fail('공지 제목을 2자 이상 입력해 주세요.');
  if (title.length > 60) return fail('공지 제목은 60자 이내로 입력해 주세요.');
  if (body.length < 5) return fail('공지 내용을 5자 이상 입력해 주세요.');
  if (!AUDIENCES.includes(input.audience)) return fail('공지 대상을 선택해 주세요.');

  let n = db.notices.length + 1;
  while (db.notices.some((x) => x.id === `n${n}`)) n++;
  const id = `n${n}`;
  db.notices.push({ id, title, body, audience: input.audience, createdAt: db.meta.today, pinned: !!input.pinned, authorId: byId });

  const recipients = noticeRecipients(db, input.audience);
  for (const channel of new Set(input.channels ?? [])) {
    db.notifications.push({
      id: `nt_n${n}_${channel === '앱 알림' ? 'app' : 'sms'}`,
      noticeId: id,
      channel,
      recipientCount: recipients,
      message: title,
      sentAt: `${db.meta.today}T09:00`,
    });
  }
  return ok(id);
}

export function setPinned(db: Db, id: string, pinned: boolean, byId: string): Res {
  if (!isAdmin(db, byId)) return notAdmin();
  const n = db.notices.find((x) => x.id === id);
  if (!n) return fail('공지를 찾을 수 없습니다.');
  n.pinned = pinned;
  return ok(undefined);
}

/** 공지를 지운다. 이미 남은 발송 내역은 감사 기록이므로 그대로 둔다. */
export function deleteNotice(db: Db, id: string, byId: string): Res {
  if (!isAdmin(db, byId)) return notAdmin();
  if (!db.notices.some((x) => x.id === id)) return fail('공지를 찾을 수 없습니다.');
  db.notices = db.notices.filter((x) => x.id !== id);
  return ok(undefined);
}
