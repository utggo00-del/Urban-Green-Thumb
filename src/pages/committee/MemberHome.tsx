import { CalendarClock, Check, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Notice } from '../../components/Badge';
import { COMMITTEE_RULES } from '../../config';
import { useDb, useSession } from '../../data/useDb';
import * as act from '../../data/workflowActions';
import { minAttendeesForQuorum } from '../../lib/committee';
import { dDayLabel, formatDateTime } from '../../lib/date';
import { AGENDA_RESULT, MEETING_STATUS } from '../../lib/labels';
import { meetingLabel } from '../../lib/meeting';
import { usePageTitle } from '../../lib/usePageTitle';
import type { Meeting } from '../../types';

const CHOICE_TONE = { 찬성: 'success', 반대: 'danger', 보류: 'warn' } as const;

function MeetingCard({ m, memberId }: { m: Meeting; memberId: string }) {
  const db = useDb();
  const { today } = useSession();
  const [error, setError] = useState<string | null>(null);
  const agendas = db.agendas.filter((a) => a.meetingId === m.id);
  const here = m.attendeeIds.includes(memberId);
  const canCheck = m.status !== '종료';

  const toggle = (present: boolean) => {
    const r = act.setAttendance(m.id, memberId, present);
    setError(r.ok ? null : r.error);
  };

  return (
    <article className="card space-y-4" aria-label={meetingLabel(m)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-extrabold">{meetingLabel(m)}</h2>
          <p className="muted flex flex-wrap items-center gap-x-2 text-sm">
            <CalendarClock aria-hidden className="size-4" /> {formatDateTime(m.scheduledAt)}
            {m.status === '예정' && <strong>({dDayLabel(m.scheduledAt.slice(0, 10), today)})</strong>} · {m.place}
          </p>
        </div>
        <Badge tone={MEETING_STATUS[m.status].tone}>{MEETING_STATUS[m.status].label}</Badge>
      </div>

      {canCheck && (
        <div className={`space-y-2 rounded-xl p-3 ${here ? 'bg-leaf-100 text-leaf-800' : 'bg-amber-100 text-amber-800'}`}>
          <p className="flex items-center gap-2 font-bold">
            {here ? <Check aria-hidden className="size-5" /> : null}
            {here ? '출석 체크를 마쳤어요.' : '아직 출석 체크를 하지 않았어요. 개회 전에 출석 체크를 해 주세요.'}
          </p>
          <p className="text-sm">
            현재 출석 {m.attendeeCount}/{m.totalMembers}명 · 개회에는 재적 과반({minAttendeesForQuorum(m.totalMembers)}명 이상) 출석이 필요해요.
          </p>
          {here ? (
            m.status === '예정' && (
              <button type="button" className="btn btn-secondary !min-h-11" onClick={() => toggle(false)}>
                출석 취소
              </button>
            )
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => toggle(true)}>
              출석 체크하기
            </button>
          )}
          {error && (
            <p role="alert" className="font-bold text-red-700">
              {error}
            </p>
          )}
        </div>
      )}

      <div>
        <h3 className="mb-1 font-bold">안건 ({agendas.length}건)</h3>
        {agendas.length === 0 ? (
          <p className="muted">아직 상정된 안건이 없어요.</p>
        ) : (
          <ul className="space-y-2">
            {agendas.map((a) => {
              const mine = db.votes.find((v) => v.agendaId === a.id && v.memberId === memberId);
              return (
                <li key={a.id}>
                  <Link to={`/committee/agendas/${a.id}`} className="flex items-center justify-between gap-3 rounded-xl border-2 border-soil-200 p-3 no-underline hover:border-leaf-700 hover:bg-leaf-50">
                    <span className="min-w-0">
                      <span className="block font-bold text-ink">{a.title}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge>{a.kind}</Badge>
                        <Badge tone={AGENDA_RESULT[a.result].tone}>{AGENDA_RESULT[a.result].label}</Badge>
                        {a.result === '미의결' &&
                          (mine ? <Badge tone={CHOICE_TONE[mine.choice]}>내 의견: {mine.choice}</Badge> : <Badge tone="warn">내 의견 미제출</Badge>)}
                      </span>
                    </span>
                    <ChevronRight aria-hidden className="size-6 shrink-0 text-leaf-700" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </article>
  );
}

export default function MemberHome() {
  usePageTitle('안건 목록');
  const db = useDb();
  const { user } = useSession();
  const member = db.members.find((x) => x.id === user.memberId);
  const meetings = db.meetings.slice().sort((a, b) => Number(a.status === '종료') - Number(b.status === '종료') || (a.status === '종료' ? b.scheduledAt.localeCompare(a.scheduledAt) : a.scheduledAt.localeCompare(b.scheduledAt)));

  if (!member) return <Notice tone="warn">위원 정보를 찾을 수 없어요.</Notice>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">{member.name} 위원님, 안녕하세요</h1>
        <p className="muted">
          {member.position} · {member.category} · 임기 {member.termStart.slice(0, 4)}~{member.termEnd.slice(0, 4)}년. 회의에서 안건을 검토하고 찬성·반대·보류 의견을 내 주세요.
        </p>
      </div>
      <Notice tone="info">
        <p className="text-sm">
          의결은 <strong>재적 과반 출석</strong>으로 개회하고 <strong>출석 과반 찬성</strong>으로 가결돼요. (조례 제8조, 재적 {db.members.length}명 · 위원은 {COMMITTEE_RULES.maxMembers}명 이내) 제출한 의견은 간사 화면에 자동 집계돼요.
        </p>
      </Notice>
      {meetings.map((m) => (
        <MeetingCard key={m.id} m={m} memberId={member.id} />
      ))}
    </div>
  );
}
