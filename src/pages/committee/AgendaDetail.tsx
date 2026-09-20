import { ArrowLeft, Check, Lock } from 'lucide-react';
import { Suspense, lazy, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge, KindBadge, Notice } from '../../components/Badge';
import { DocList } from '../../components/DocList';
import { GardenCardSkeleton } from '../../components/GardenCard';
import { FACILITY_LABELS } from '../../config';
import { getGarden, getUser } from '../../data/selectors';
import { useDb, useSession } from '../../data/useDb';
import * as act from '../../data/workflowActions';
import { formatDate, feeLabel } from '../../lib/date';
import { toGardenView, toPyeong } from '../../lib/gardens';
import { AGENDA_RESULT } from '../../lib/labels';
import { meetingLabel } from '../../lib/meeting';
import { usePageTitle } from '../../lib/usePageTitle';
import type { VoteChoice } from '../../types';

const GardenMap = lazy(() => import('../../components/GardenMap'));

/** 심의위원에게는 소유자 개인정보를 가려서 보여준다: 홍길동 → 홍○○ */
const maskName = (name: string) => (name.length <= 1 ? name : name[0] + '○'.repeat(name.length - 1));

const CHOICES: { value: VoteChoice; hint: string }[] = [
  { value: '찬성', hint: '이 텃밭을 도시텃밭으로 지정하는 데 찬성해요.' },
  { value: '반대', hint: '지정에 반대해요. 의견란에 이유를 적어 주세요.' },
  { value: '보류', hint: '보완이 필요해 다음 회의에서 다시 보고 싶어요.' },
];

export default function AgendaDetail() {
  const { id = '' } = useParams();
  const db = useDb();
  const { user } = useSession();
  const a = db.agendas.find((x) => x.id === id);
  usePageTitle(a?.title ?? '안건 상세');
  const m = a && db.meetings.find((x) => x.id === a.meetingId);
  const myVote = a && user.memberId ? db.votes.find((v) => v.agendaId === a.id && v.memberId === user.memberId) : undefined;

  const [choice, setChoice] = useState<VoteChoice | ''>('');
  // null이면 이미 제출한 의견을 그대로 보여 준다
  const [comment, setComment] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!a || !m) {
    return (
      <Notice tone="warn">
        안건을 찾을 수 없어요. <Link to="/committee">안건 목록으로</Link>
      </Notice>
    );
  }
  const g = a.gardenId ? getGarden(db, a.gardenId) : undefined;
  const owner = g ? getUser(db, g.ownerId) : undefined;
  const memberId = user.memberId ?? '';
  const attending = m.attendeeIds.includes(memberId);
  const inspector = g?.inspection ? getUser(db, g.inspection.inspectedBy) : undefined;
  const decided = a.result !== '미의결';
  const selected = choice || myVote?.choice || '';

  const submit = () => {
    if (!selected) return setError('찬성·반대·보류 중 하나를 선택해 주세요.');
    const r = act.castVote({ agendaId: a.id, memberId, choice: selected, comment: comment ?? myVote?.comment ?? '' });
    setError(r.ok ? null : r.error);
    setSaved(r.ok);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to="/committee" className="inline-flex min-h-12 items-center gap-1 font-bold">
        <ArrowLeft aria-hidden className="size-5" /> 안건 목록
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{a.kind}</Badge>
          <Badge tone={AGENDA_RESULT[a.result].tone}>{AGENDA_RESULT[a.result].label}</Badge>
          {decided && (
            <span className="inline-flex items-center gap-1 text-sm font-bold text-soil-700">
              <Lock aria-hidden className="size-4" /> 의결 확정
            </span>
          )}
        </div>
        <h1 className="text-2xl font-extrabold">{a.title}</h1>
        <p className="muted">
          {meetingLabel(m)} · {a.summary}
        </p>
        <p className="muted text-sm">도시텃밭 지정은 도시농업위원회 심의를 거칩니다. (조례 제5조, 제11조)</p>
      </header>

      {g && (
        <>
          <section aria-labelledby="ov" className="card space-y-3">
            <h2 id="ov" className="text-xl font-bold">텃밭 개요</h2>
            <div className="flex flex-wrap gap-2">
              <KindBadge kind={g.type} />
              <Badge>{g.ordinanceType}</Badge>
              {g.type === '민간' && <Badge tone={g.isWeekendFarmOperator ? 'success' : 'neutral'}>{g.isWeekendFarmOperator ? '주말농원사업자' : '주말농원사업자 아님'}</Badge>}
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                ['텃밭 이름', g.name],
                ['주소', g.address],
                ['소유자', !owner ? '-' : g.type === '공공' ? `${owner.name}` : `${maskName(owner.name)} (개인정보 보호를 위해 일부만 표시)`],
                ['구획 수 · 면적', `${g.plotCount}개 · 구획당 ${g.plotAreaM2}㎡(약 ${toPyeong(g.plotAreaM2)}평) · 전체 ${g.totalAreaM2.toLocaleString('ko-KR')}㎡`],
                ['시설', g.facilities.length ? g.facilities.map((f) => FACILITY_LABELS[f]).join(', ') : '없음'],
                ['이용료', feeLabel(g.fee)],
                ['최소 제공 기간', `${g.seasonMinTerm}개월`],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="muted text-sm">{k}</dt>
                  <dd className="font-bold">{v}</dd>
                </div>
              ))}
            </dl>
            <Suspense fallback={<GardenCardSkeleton />}>
              <GardenMap items={[toGardenView(db, g)]} zoomToSingle className="h-56" label={`${g.name} 위치 지도`} />
            </Suspense>
          </section>

          <section aria-labelledby="docs" className="card space-y-4">
            <h2 id="docs" className="text-xl font-bold">서류와 실무 검수 의견</h2>
            <DocList title="토지 서류" files={g.documents} />
            <DocList title="소유자 동의서 (조례 제11조)" files={g.ownerConsentDoc ? [g.ownerConsentDoc] : []} note="열람은 모의입니다." />
            {g.inspection ? (
              <div>
                <h3 className="mb-1 font-bold">실무 검수 결과 <span className="muted text-sm font-normal">({formatDate(g.inspection.inspectedAt)} · {inspector?.name ?? '담당자'})</span></h3>
                <ul className="mb-2 space-y-1">
                  {Object.entries(g.inspection.checklist).map(([k, ok]) => (
                    <li key={k} className="flex items-center gap-2">
                      <Check aria-hidden className={`size-4 ${ok ? 'text-leaf-700' : 'text-soil-600'}`} />
                      <span>{k}</span> <span className="sr-only">{ok ? '확인됨' : '미확인'}</span>
                    </li>
                  ))}
                </ul>
                <p className="rounded-lg bg-leaf-50 p-3">{g.inspection.opinion}</p>
              </div>
            ) : (
              <p className="muted">실무 검수 의견이 없어요.</p>
            )}
          </section>
        </>
      )}

      <section aria-labelledby="vote" className="card space-y-4 border-leaf-700">
        <h2 id="vote" className="text-xl font-bold">내 의견</h2>

        {decided ? (
          <Notice tone={a.result === '가결' ? 'success' : a.result === '부결' ? 'danger' : 'warn'}>
            <p className="font-bold">
              {a.result}로 의결되었어요 · 찬성 {a.yes} · 반대 {a.no} · 보류 {a.abstain} / 출석 {m.attendeeCount}명
            </p>
            {myVote && <p className="text-sm">내가 낸 의견: {myVote.choice}</p>}
          </Notice>
        ) : m.status === '예정' ? (
          <Notice tone="info">
            <p className="font-bold">아직 개회 전이에요.</p>
            <p className="text-sm">안건을 미리 검토해 두세요. 회의가 열리면 이곳에서 의견을 낼 수 있어요. 개회 전에는 출석 체크를 해 주세요.</p>
          </Notice>
        ) : !attending ? (
          <Notice tone="warn">
            <p className="font-bold">출석 체크를 한 위원만 의견을 낼 수 있어요.</p>
            <button type="button" className="btn btn-primary mt-2" onClick={() => act.setAttendance(m.id, memberId, true)}>
              출석 체크하기
            </button>
          </Notice>
        ) : (
          <>
            <fieldset className="space-y-2">
              <legend className="sr-only">찬성·반대·보류 선택</legend>
              {CHOICES.map((c) => (
                <label key={c.value} className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border-2 p-3 ${selected === c.value ? 'border-leaf-700 bg-leaf-50' : 'border-soil-200'}`}>
                  <input type="radio" name="choice" checked={selected === c.value} onChange={() => { setChoice(c.value); setSaved(false); }} className="mt-1 size-5 accent-leaf-700" />
                  <span>
                    <span className="block text-lg font-bold">{c.value}</span>
                    <span className="muted text-sm">{c.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <label className="block">
              <span className="mb-1 block font-bold">의견 (선택)</span>
              <textarea className="field min-h-24" value={comment ?? myVote?.comment ?? ''} onChange={(e) => { setComment(e.target.value); setSaved(false); }} placeholder="검토 의견을 남겨 주세요." />
            </label>
            {error && <p role="alert" className="rounded-lg bg-red-100 p-3 font-bold text-red-700">{error}</p>}
            {saved && <p role="status" className="rounded-lg bg-leaf-100 p-3 font-bold text-leaf-800">의견이 제출되었어요. 개회 중에는 다시 바꿔서 제출할 수 있어요.</p>}
            <button type="button" className="btn btn-primary w-full sm:w-auto" onClick={submit}>
              {myVote ? '의견 다시 제출' : '의견 제출'}
            </button>
            {myVote && !saved && <p className="muted text-sm">현재 제출된 의견: <strong>{myVote.choice}</strong></p>}
          </>
        )}
        <p className="muted text-sm">제출한 의견은 간사 화면의 의결 기록에 자동 집계되고, 개회 요건과 가결 요건이 자동 판정돼요. (프로토타입의 모의 투표)</p>
      </section>
    </div>
  );
}
