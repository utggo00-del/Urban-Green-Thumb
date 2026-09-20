// 공지·알림, 대리 신청의 상태 변경. 규칙은 lib/notices.ts, lib/application.ts(순수 로직)에 있다.
import * as ap from '../lib/application';
import * as nt from '../lib/notices';
import { me, run } from './run';

export const publishNotice = (input: nt.NoticeInput) => run((d) => nt.publishNotice(d, input, me()));
export const setPinned = (id: string, pinned: boolean) => run((d) => nt.setPinned(d, id, pinned, me()));
export const deleteNotice = (id: string) => run((d) => nt.deleteNotice(d, id, me()));
export const proxyApply = (input: ap.ProxyInput) => run((d) => ap.proxyApply(d, input, me()));
