import { CalendarClock, ChevronRight, FilePlus2, History } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Badge, Notice } from '../../components/Badge';
import { FileAttach } from '../../components/DocList';
import { Steps } from '../../components/Steps';
import { resubmitSupplement } from '../../data/workflowActions';
import { gardensOwnedBy, nextMeeting } from '../../data/selectors';
import { useDb, useSession } from '../../data/useDb';
import { SAMPLE_DOCS } from '../../config';
import { dDayLabel, formatDate, formatDateTime } from '../../lib/date';
import { GARDEN_STATUS, REGISTRATION_STEPS, registrationFlow } from '../../lib/labels';
import { meetingLabel, designationLabel } from '../../lib/meeting';
import { usePageTitle } from '../../lib/usePageTitle';
import type { Garden } from '../../types';

/** 다음 위원회 회의일과 D-day 안내 (SPEC 3.1-7) */
export function NextMeetingNotice() {
  const db = useDb();
  const { today } = useSession();
  const m = nextMeeting(db);
  if (!m) return <Notice tone="info">예정된 위원회 회의가 아직 없어요. 회의가 정해지면 이곳에 안내해 드려요.</Notice>;
  return (
    <Notice tone="info">
      <p className="flex flex-wrap items-center gap-x-2 font-bold">
        <CalendarClock aria-hidden className="size-5" /> 다음 위원회 회의 {formatDateTime(m.scheduledAt)} <span>({dDayLabel(m.scheduledAt.slice(0, 10), today)})</span>
      </p>
      <p className="text-sm">{meetingLabel(m)} · 정례회의 일정에 따라 심의까지 시일이 걸릴 수 있습니다.</p>
    </Notice>
  );
}

function SupplementForm({ garden }: { garden: Garden }) {
  const [documents, setDocuments] = useState(garden.documents);
  const [consent, setConsent] = useState([garden.ownerConsentDoc]);
  const [memo, setMemo] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-3 rounded-xl border-2 border-amber-800 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const r = resubmitSupplement(garden.id, { documents, ownerConsentDoc: consent[0] ?? '', memo });
        if (!r.ok) setError(r.error);
      }}
    >
      <h4 className="font-extrabold">보완 자료 다시 제출하기</h4>
      <FileAttach id={`sup-docs-${garden.id}`} label="토지 서류 다시 선택" multiple files={documents} onChange={setDocuments} />
      <FileAttach id={`sup-consent-${garden.id}`} label="소유자 동의서 다시 선택" files={consent} onChange={setConsent} />
      <label className="block">
        <span className="mb-1 block font-bold">담당자에게 남길 말 (선택)</span>
        <textarea className="field min-h-20" value={memo} onChange={(e) => setMemo(e.target.value)} />
      </label>
      {error && (
        <p role="alert" className="font-bold text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary">
          보완 자료 제출
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => { setDocuments([...SAMPLE_DOCS.land]); setConsent([SAMPLE_DOCS.consent]); }}>
          시연용 샘플 서류 첨부
        </button>
      </div>
    </form>
  );
}

function RegistrationCard({ g }: { g: Garden }) {
  const flow = registrationFlow(g);
  const labels = REGISTRATION_STEPS.map((l, i) => (i === 3 ? flow.resultLabel : l));
  const st = GARDEN_STATUS[g.status];
  const supplement = g.status === '검수중' && !!g.reviewNote;

  return (
    <article className="card space-y-4" aria-label={`${g.name} 등록 현황`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-extrabold">{g.name}</h2>
          <p className="muted text-sm">
            {g.type} 텃밭 · {g.ordinanceType} · {g.dong} · 신청일 {formatDate(g.createdAt)}
          </p>
        </div>
        <Badge tone={supplement ? 'warn' : st.tone}>{supplement ? '보완 요청' : st.label}</Badge>
      </div>

      <Steps labels={labels} current={flow.current} failedAt={flow.failed ? 3 : undefined} ariaLabel="등록 진행 단계" />

      {g.status === '지정' && g.designation && (
        <Notice tone="success">
          <p className="font-bold">위원회 심의를 통과해 지정되었어요!</p>
          <p className="text-sm">{designationLabel(g.designation)} · 이제 시민에게 공개되고, 모집을 열 수 있어요. (조례 제11조)</p>
          <Link to={`/gardens/${g.id}`} className="mt-1 inline-block font-bold">
            시민 화면에서 보기
          </Link>
        </Notice>
      )}
      {(g.status === '부결' || g.status === '보류') && g.reviewNote && (
        <Notice tone={g.status === '부결' ? 'danger' : 'warn'}>
          <p className="font-bold">{g.status === '부결' ? '부결 사유' : '보류 사유'}</p>
          <p>{g.reviewNote}</p>
          {g.status === '보류' && <p className="mt-1 text-sm">보완한 뒤 텃밭지원과에 알려 주시면 다음 회의에 다시 상정돼요.</p>}
        </Notice>
      )}
      {supplement && (
        <>
          <Notice tone="warn">
            <p className="font-bold">담당자가 보완을 요청했어요</p>
            <p>{g.reviewNote}</p>
          </Notice>
          <SupplementForm garden={g} />
        </>
      )}
      {g.status === '검수중' && !supplement && <p className="muted">텃밭지원과에서 서류와 요건을 검수하고 있어요.</p>}
      {g.status === '심의대기' && <p className="muted">실무 검수를 통과했어요. 위원회 회의에 안건으로 상정되면 심의가 시작돼요. 심의 전에는 시민에게 공개되지 않아요.</p>}
      {g.status === '심의중' && <p className="muted">위원회가 심의하고 있어요. 결과는 이 화면에 표시돼요.</p>}

      {g.history && g.history.length > 0 && (
        <details>
          <summary className="flex min-h-12 items-center gap-2 font-bold">
            <History aria-hidden className="size-5" /> 진행 이력 ({g.history.length}건)
          </summary>
          <ol className="mt-2 space-y-2 border-l-4 border-leaf-200 pl-4">
            {g.history.map((h, i) => (
              <li key={i}>
                <p className="font-bold">
                  {h.label} <span className="muted text-sm font-normal">{formatDate(h.at)}</span>
                </p>
                {h.note && <p className="muted text-sm">{h.note}</p>}
              </li>
            ))}
          </ol>
        </details>
      )}
    </article>
  );
}

export default function Register() {
  usePageTitle('텃밭 등록 신청');
  const db = useDb();
  const { user } = useSession();
  const location = useLocation();
  const justRegistered = (location.state as { justRegistered?: string } | null)?.justRegistered;
  const mine = gardensOwnedBy(db, user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">텃밭 등록 신청</h1>
          <p className="muted">내 땅을 도시텃밭으로 제공하고 싶으신가요? 등록 후 위원회 심의를 거쳐 지정되면 시민에게 공개돼요.</p>
        </div>
        <Link to="/register/new" className="btn btn-primary w-full sm:w-auto">
          <FilePlus2 aria-hidden className="size-5" /> 새 텃밭 등록하기 <ChevronRight aria-hidden className="size-5" />
        </Link>
      </div>

      <NextMeetingNotice />

      {justRegistered && mine.some((g) => g.id === justRegistered) && (
        <Notice tone="success">
          <p className="font-bold">등록 신청이 접수되었어요.</p>
          <p className="text-sm">텃밭지원과가 서류를 검수한 뒤 위원회 안건으로 상정해요. 진행 상황은 아래에서 확인하세요.</p>
        </Notice>
      )}

      <section aria-labelledby="mine" className="space-y-4">
        <h2 id="mine" className="text-xl font-bold">
          내 등록 목록
        </h2>
        {mine.length === 0 ? (
          <div className="card space-y-3 text-center">
            <p className="text-lg font-bold">아직 등록한 텃밭이 없어요.</p>
            <Link to="/register/new" className="btn btn-primary">
              첫 텃밭 등록하기
            </Link>
          </div>
        ) : (
          mine.map((g) => <RegistrationCard key={g.id} g={g} />)
        )}
      </section>
    </div>
  );
}
