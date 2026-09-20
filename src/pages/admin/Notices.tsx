import { Megaphone, Pin, PinOff, Send, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Badge, Notice as Callout } from '../../components/Badge';
import { Field } from '../../components/Field';
import { deleteNotice, publishNotice, setPinned } from '../../data/adminActions';
import { getUser } from '../../data/selectors';
import { useDb } from '../../data/useDb';
import { formatDate, formatDateTime } from '../../lib/date';
import { AUDIENCES, CHANNELS, noticeRecipients } from '../../lib/notices';
import { usePageTitle } from '../../lib/usePageTitle';
import type { Notice, NotificationLog } from '../../types';

const AUDIENCE_HINT: Record<Notice['audience'], string> = {
  전체: '시민·텃밭 제공자 모두',
  이용자: '구획을 배정받았거나 이용 중인 분',
  제공자: '텃밭을 등록한 소유자',
};

export default function Notices() {
  usePageTitle('공지·알림 관리');
  const db = useDb();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Notice['audience']>('전체');
  const [pinned, setPin] = useState(false);
  const [channels, setChannels] = useState<NotificationLog['channel'][]>(['앱 알림']);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const recipients = noticeRecipients(db, audience);
  const notices = db.notices.slice().sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id, undefined, { numeric: true }));
  const logs = db.notifications.slice().sort((a, b) => b.sentAt.localeCompare(a.sentAt) || b.id.localeCompare(a.id, undefined, { numeric: true }));

  const toggle = (c: NotificationLog['channel']) => setChannels((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setDone(null);
    const r = publishNotice({ title, body, audience, pinned, channels });
    if (!r.ok) return setError(r.error);
    setError(null);
    setTitle('');
    setBody('');
    setPin(false);
    setDone(channels.length ? `공지를 게시했어요. ${channels.join(', ')} 채널로 ${recipients}명에게 발송한 내역이 남았어요. (모의 발송)` : '공지를 게시했어요. 알림은 보내지 않았어요.');
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">공지·알림 관리</h1>
        <p className="muted">공지를 작성해 시민 화면에 올리고, 알림 발송 내역을 확인해요. 실제 문자·알림톡은 보내지 않고 내역만 남겨요. (실서비스에서 연동 예정)</p>
      </div>

      <form onSubmit={submit} className="card space-y-4" noValidate>
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Megaphone aria-hidden className="size-6" /> 공지 작성
        </h2>
        <Field label="제목" required>
          {(p) => <input {...p} className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="예) 10월 텃밭 정리 안내" autoComplete="off" />}
        </Field>
        <Field label="내용" required>
          {(p) => <textarea {...p} className="field min-h-28" value={body} onChange={(e) => setBody(e.target.value)} />}
        </Field>
        <Field label="공지 대상" hint={`${AUDIENCE_HINT[audience]} · 알림 수신 예정 ${recipients}명`}>
          {(p) => (
            <select {...p} className="field" value={audience} onChange={(e) => setAudience(e.target.value as Notice['audience'])}>
              {AUDIENCES.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          )}
        </Field>
        <fieldset>
          <legend className="mb-1 font-bold">알림 발송 (모의)</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {CHANNELS.map((c) => (
              <label key={c} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border-2 border-soil-200 px-3">
                <input type="checkbox" className="size-5 accent-leaf-700" checked={channels.includes(c)} onChange={() => toggle(c)} />
                <span className="font-bold">{c}</span>
              </label>
            ))}
          </div>
          <p className="muted mt-1 text-sm">선택하지 않으면 공지만 게시해요.</p>
        </fieldset>
        <label className="flex min-h-12 cursor-pointer items-center gap-3">
          <input type="checkbox" className="size-5 accent-leaf-700" checked={pinned} onChange={(e) => setPin(e.target.checked)} />
          <span className="font-bold">중요 공지로 고정</span>
        </label>
        {error && (
          <p role="alert" className="rounded-lg bg-red-100 p-3 font-bold text-red-700">
            {error}
          </p>
        )}
        {done && <Callout tone="success">{done}</Callout>}
        <button type="submit" className="btn btn-primary w-full sm:w-auto">
          <Send aria-hidden className="size-5" /> 공지 게시
        </button>
      </form>

      <section aria-labelledby="list" className="space-y-3">
        <h2 id="list" className="text-xl font-bold">
          게시된 공지 <span className="text-leaf-700">{notices.length}건</span>
        </h2>
        <ul className="space-y-3">
          {notices.map((n) => (
            <li key={n.id} className="card space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="flex flex-wrap items-center gap-2 font-extrabold">
                    {n.pinned && <Badge tone="info">중요</Badge>}
                    {n.title}
                  </p>
                  <p className="muted text-sm">
                    {formatDate(n.createdAt)} · 대상 {n.audience} · 작성 {getUser(db, n.authorId)?.name}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-secondary !min-h-11" onClick={() => setPinned(n.id, !n.pinned)} aria-label={`${n.title} ${n.pinned ? '고정 해제' : '고정'}`}>
                    {n.pinned ? <PinOff aria-hidden className="size-4" /> : <Pin aria-hidden className="size-4" />} {n.pinned ? '고정 해제' : '고정'}
                  </button>
                  {deleting === n.id ? (
                    <span className="flex flex-wrap items-center gap-2" role="group" aria-label="삭제 확인">
                      <button type="button" className="btn btn-danger !min-h-11" onClick={() => { deleteNotice(n.id); setDeleting(null); }}>
                        삭제 확인
                      </button>
                      <button type="button" className="btn btn-secondary !min-h-11" onClick={() => setDeleting(null)}>
                        취소
                      </button>
                    </span>
                  ) : (
                    <button type="button" className="btn btn-secondary !min-h-11" onClick={() => setDeleting(n.id)} aria-label={`${n.title} 삭제`}>
                      <Trash2 aria-hidden className="size-4" /> 삭제
                    </button>
                  )}
                </div>
              </div>
              <p>{n.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="logs" className="space-y-3">
        <h2 id="logs" className="text-xl font-bold">알림 발송 내역 <span className="muted text-base font-normal">(모의)</span></h2>
        <p className="muted text-sm">공지 발송뿐 아니라 추첨 결과 발표, 경고·회수 통보도 여기에 남아요. 공지를 지워도 발송 내역은 그대로 둬요.</p>
        <div className="card overflow-x-auto !p-0" role="region" tabIndex={0} aria-label="알림 발송 내역">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">알림 발송 내역</caption>
            <thead>
              <tr className="border-b-2 border-soil-200">
                {['발송 시각', '채널', '수신', '내용'].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-soil-200 align-top">
                  <td className="px-3 py-2">{formatDateTime(l.sentAt)}</td>
                  <td className="px-3 py-2">{l.channel}</td>
                  <td className="px-3 py-2">{l.recipientCount}명</td>
                  <td className="px-3 py-2">{l.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
