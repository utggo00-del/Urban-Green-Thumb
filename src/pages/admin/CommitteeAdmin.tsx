import { CalendarClock, ChevronRight, DatabaseZap } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Badge, Notice } from '../../components/Badge';
import { Field } from '../../components/Field';
import { COMMITTEE_RULES } from '../../config';
import { nextMeeting } from '../../data/selectors';
import { useDb, useSession } from '../../data/useDb';
import { createMeeting } from '../../data/workflowActions';
import { dDayLabel, formatDate, formatDateTime } from '../../lib/date';
import { MEETING_STATUS } from '../../lib/labels';
import { meetingLabel, nextRound, roundLabel } from '../../lib/meeting';
import { proposableGardens } from '../../lib/workflow';
import { usePageTitle } from '../../lib/usePageTitle';
import type { MeetingHalf, MeetingKind } from '../../types';

function NewMeetingForm() {
  const db = useDb();
  const navigate = useNavigate();
  const [kind, setKind] = useState<MeetingKind>('정례');
  const [half, setHalf] = useState<MeetingHalf>('하반기');
  const [when, setWhen] = useState('');
  const [place, setPlace] = useState('시흥시청 회의실(가상)');
  const [error, setError] = useState<string | null>(null);

  const year = when ? Number(when.slice(0, 4)) : null;
  const preview = year ? roundLabel(year, nextRound(db.meetings, year, kind), kind) + (kind === '정례' ? `(${half})` : '') : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = createMeeting({ kind, half: kind === '정례' ? half : undefined, scheduledAt: when, place });
    if (!r.ok) return setError(r.error);
    navigate(`/admin/committee/meetings/${r.value}`);
  };

  return (
    <form onSubmit={submit} className="card space-y-4" noValidate>
      <h2 className="text-xl font-bold">회의 등록</h2>
      <fieldset>
        <legend className="mb-1 font-bold">회의 종류</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(['정례', '임시'] as const).map((k) => (
            <label key={k} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 p-3 ${kind === k ? 'border-leaf-700 bg-leaf-50' : 'border-soil-200'}`}>
              <input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} className="size-5 accent-leaf-700" />
              <span>
                <span className="block font-bold">{k}회의</span>
                <span className="muted text-sm">{k === '정례' ? `연 ${COMMITTEE_RULES.regularMeetingsPerYear}회(상·하반기)` : '위원장이 필요하다고 인정할 때 소집'}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {kind === '정례' && (
        <Field label="반기" required>
          {(p) => (
            <select {...p} className="field" value={half} onChange={(e) => setHalf(e.target.value as MeetingHalf)}>
              <option>상반기</option>
              <option>하반기</option>
            </select>
          )}
        </Field>
      )}
      <Field label="회의 일시" required hint="상반기는 1~6월, 하반기는 7~12월 일정이어야 해요.">
        {(p) => (
          <input
            {...p}
            type="datetime-local"
            className="field"
            value={when}
            onChange={(e) => {
              setWhen(e.target.value);
              const month = Number(e.target.value.slice(5, 7));
              if (month) setHalf(month <= 6 ? '상반기' : '하반기'); // 일시에 맞춰 반기를 자동 선택
            }}
          />
        )}
      </Field>
      <Field label="장소" required>
        {(p) => <input {...p} className="field" value={place} onChange={(e) => setPlace(e.target.value)} />}
      </Field>
      {preview && (
        <p className="rounded-lg bg-leaf-50 p-3 font-bold">
          등록하면 <span className="text-leaf-800">{preview}</span>로 회차가 자동 부여돼요. (회차는 연도별로 세요)
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-red-100 p-3 font-bold text-red-700">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary w-full sm:w-auto">
        회의 등록
      </button>
    </form>
  );
}

/** 위원회 관리(간사 화면) — 조례 제5조(위원회 기능)·제8조(회의) 절차 */
export default function CommitteeAdmin() {
  usePageTitle('위원회 관리');
  const db = useDb();
  const { isSecretary, today } = useSession();
  const location = useLocation();
  const migrated = (location.state as { migrated?: string } | null)?.migrated;

  if (!isSecretary) {
    return <Notice tone="warn">위원회 관리는 도시농업 담당주무관(위원회 간사)만 이용할 수 있어요. (조례 제9조)</Notice>;
  }

  const next = nextMeeting(db);
  const meetings = db.meetings.slice().sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  const waiting = proposableGardens(db);
  const migratedGarden = migrated ? db.gardens.find((g) => g.id === migrated) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">위원회 관리 <span className="muted text-base font-normal">(간사)</span></h1>
        <p className="muted">
          텃밭 지정은 도시농업위원회 심의를 거칩니다. 정례회의는 연 {COMMITTEE_RULES.regularMeetingsPerYear}회(상·하반기)와 필요 시 임시회의, 재적위원 과반 출석·출석위원 과반 찬성으로 의결해요.
          <span className="ml-1 text-sm">(조례 제5조, 제8조, 제11조)</span>
        </p>
      </div>

      {migratedGarden && <Notice tone="success">「{migratedGarden.name}」을(를) 지정 텃밭으로 이관 등록했어요. 시민 화면에 공개되고 모집을 열 수 있어요.</Notice>}

      <section aria-label="요약" className="grid gap-3 sm:grid-cols-3">
        <div className="card">
          <p className="muted text-sm font-bold">다음 회의</p>
          <p className="text-2xl font-extrabold text-leaf-800">{next ? dDayLabel(next.scheduledAt.slice(0, 10), today) : '-'}</p>
          <p className="muted text-sm">{next ? `${meetingLabel(next)} · ${formatDateTime(next.scheduledAt)}` : '예정된 회의 없음'}</p>
        </div>
        <div className="card">
          <p className="muted text-sm font-bold">상정 대기 텃밭</p>
          <p className="text-2xl font-extrabold text-leaf-800">{waiting.length}곳</p>
          <p className="muted text-sm">실무 검수 통과·보류 텃밭</p>
        </div>
        <div className="card">
          <p className="muted text-sm font-bold">위원</p>
          <p className="text-2xl font-extrabold text-leaf-800">
            {db.members.filter((m) => m.isActive).length}명 <span className="text-base font-bold">/ {COMMITTEE_RULES.maxMembers}명 이내</span>
          </p>
          <p className="muted text-sm">재적 과반 = {Math.floor(db.members.length * COMMITTEE_RULES.quorumRatio) + 1}명 이상 출석</p>
        </div>
      </section>

      <section aria-labelledby="meetings" className="space-y-3">
        <h2 id="meetings" className="text-xl font-bold">회의 목록</h2>
        <ul className="space-y-3">
          {meetings.map((m) => {
            const agendas = db.agendas.filter((a) => a.meetingId === m.id);
            return (
              <li key={m.id}>
                <Link to={`/admin/committee/meetings/${m.id}`} className="card flex items-center justify-between gap-3 no-underline hover:border-leaf-700 hover:bg-leaf-50">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <strong className="text-lg text-ink">{meetingLabel(m)}</strong>
                      <Badge tone={MEETING_STATUS[m.status].tone}>{MEETING_STATUS[m.status].label}</Badge>
                    </span>
                    <span className="muted flex flex-wrap items-center gap-x-3 text-sm">
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock aria-hidden className="size-4" /> {formatDateTime(m.scheduledAt)}
                      </span>
                      <span>안건 {agendas.length}건</span>
                      <span>출석 {m.attendeeCount}/{m.totalMembers}명</span>
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="size-6 shrink-0 text-leaf-700" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <NewMeetingForm />
        <section className="card space-y-3">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <DatabaseZap aria-hidden className="size-6" /> 기존 지정 텃밭 이관 입력
          </h2>
          <p>이미 위원회 심의를 거쳐 조성된 텃밭은 <strong>심의 회차·일자</strong>를 직접 입력해 ‘지정’ 상태로 등록해요.</p>
          <p className="muted text-sm">이관 여부와 소급 심의는 시행규칙·운영지침으로 정할 사항이며, 프로토타입은 회차·일자를 입력하는 방식으로 처리해요.</p>
          <Link to="/admin/committee/migrate" className="btn btn-secondary w-full sm:w-auto">
            이관 입력하기
          </Link>
        </section>
      </div>

      <section aria-labelledby="members" className="card space-y-3">
        <h2 id="members" className="text-xl font-bold">위원 명단 <span className="muted text-base font-normal">(가상 · 조례 제4조: 15명 이내, 임기 {COMMITTEE_RULES.termYears}년 연임 가능)</span></h2>
        <div className="overflow-x-auto" role="region" tabIndex={0} aria-label="도시농업위원회 위원 명단">
          <table className="w-full min-w-[32rem] text-left">
            <caption className="sr-only">도시농업위원회 위원 명단</caption>
            <thead>
              <tr className="border-b-2 border-soil-200">
                <th scope="col" className="py-2 pr-3">이름</th>
                <th scope="col" className="py-2 pr-3">직위</th>
                <th scope="col" className="py-2 pr-3">구성 분류</th>
                <th scope="col" className="py-2">임기</th>
              </tr>
            </thead>
            <tbody>
              {db.members.map((m) => (
                <tr key={m.id} className="border-b border-soil-200">
                  <th scope="row" className="py-2 pr-3 font-bold">{m.name}</th>
                  <td className="py-2 pr-3">{m.position}</td>
                  <td className="py-2 pr-3">{m.category}</td>
                  <td className="py-2">{formatDate(m.termStart)} ~ {formatDate(m.termEnd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted text-sm">실제 위원 위촉·수당 지급(조례 제4조, 제10조)은 이 앱에서 다루지 않아요.</p>
      </section>
    </div>
  );
}
