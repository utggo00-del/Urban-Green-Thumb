import { ArrowLeft, Check, Lock, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge, Notice } from '../../components/Badge';
import { DocList } from '../../components/DocList';
import { DEMO } from '../../config';
import { getGarden, getUser } from '../../data/selectors';
import { useDb, useSession } from '../../data/useDb';
import * as act from '../../data/workflowActions';
import { judgeAgenda, minAttendeesForQuorum, presiding, tallyVotes } from '../../lib/committee';
import { formatDate, formatDateTime } from '../../lib/date';
import { AGENDA_RESULT, MEETING_STATUS } from '../../lib/labels';
import { meetingLabel } from '../../lib/meeting';
import { proposableGardens } from '../../lib/workflow';
import { usePageTitle } from '../../lib/usePageTitle';
import type { Agenda, AgendaKind, Db, Meeting } from '../../types';

const CHOICE_TONE = { 찬성: 'success', 반대: 'danger', 보류: 'warn' } as const;

function Count({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className={`rounded-lg p-2 text-center ${tone ?? 'bg-leaf-50'}`}>
      <dt className="muted text-sm">{label}</dt>
      <dd className="text-xl font-extrabold">{value}</dd>
    </div>
  );
}

function ErrorLine({ msg }: { msg: string | null }) {
  return msg ? (
    <p role="alert" className="rounded-lg bg-red-100 p-3 font-bold text-red-700">
      {msg}
    </p>
  ) : null;
}

// ───────── 출석 ─────────
function AttendancePanel({ m }: { m: Meeting }) {
  const db = useDb();
  const [error, setError] = useState<string | null>(null);
  const locked = m.status === '종료';
  const min = minAttendeesForQuorum(m.totalMembers);
  const pres = presiding(db.members, m.attendeeIds);
  const all = db.members.filter((x) => x.isActive).map((x) => x.id);

  const bulk = (ids: string[]) => {
    const r = act.setAttendanceBulk(m.id, ids);
    setError(r.ok ? null : r.error);
  };

  return (
    <section aria-labelledby="att" className="card space-y-4">
      <h2 id="att" className="text-xl font-bold">출석 체크</h2>
      <div aria-live="polite" className={`rounded-xl p-3 font-bold ${m.quorumMet ? 'bg-leaf-100 text-leaf-800' : 'bg-amber-100 text-amber-800'}`}>
        <p className="flex flex-wrap items-center gap-2">
          {m.quorumMet ? <Check aria-hidden className="size-5" /> : <X aria-hidden className="size-5" />}
          출석 {m.attendeeCount}명 / 재적 {m.totalMembers}명 — 개회 요건(재적 과반, {min}명 이상) {m.quorumMet ? '충족' : '미달'}
        </p>
        {pres && (
          <p className="mt-1 text-sm font-normal">
            주재: {pres.member.name} {pres.member.position}
            {pres.acting && ' (위원장 부재로 부위원장이 직무 대행 · 조례 제6조)'}
          </p>
        )}
      </div>

      <fieldset disabled={locked}>
        <legend className="sr-only">위원별 출석</legend>
        <ul className="grid gap-2 sm:grid-cols-2">
          {db.members.map((mem) => {
            const here = m.attendeeIds.includes(mem.id);
            return (
              <li key={mem.id}>
                <label className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border-2 px-3 ${here ? 'border-leaf-700 bg-leaf-50' : 'border-soil-200'}`}>
                  <input
                    type="checkbox"
                    checked={here}
                    className="size-5 accent-leaf-700"
                    onChange={(e) => {
                      const r = act.setAttendance(m.id, mem.id, e.target.checked);
                      setError(r.ok ? null : r.error);
                    }}
                  />
                  <span>
                    <span className="font-bold">{mem.name}</span> <span className="muted text-sm">{mem.position}</span>
                  </span>
                  {here && <Badge tone="success">출석</Badge>}
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      {!locked && (
        <div className="space-y-2 rounded-xl border-2 border-dashed border-soil-200 p-3">
          <p className="text-sm font-bold">시연 도우미 <span className="muted font-normal">— 실제로는 각 위원이 자기 화면에서 출석 체크를 해요</span></p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary !min-h-11" onClick={() => bulk(all)}>전원 출석</button>
            <button type="button" className="btn btn-secondary !min-h-11" onClick={() => bulk(all.slice(0, min - 1))}>
              {min - 1}명만 출석 (개회 요건 미달 시연)
            </button>
            <button type="button" className="btn btn-secondary !min-h-11" onClick={() => bulk([])}>출석 초기화</button>
          </div>
        </div>
      )}
      <ErrorLine msg={error} />
    </section>
  );
}

// ───────── 안건 상정 ─────────
function AddAgendaForm({ m }: { m: Meeting }) {
  const db = useDb();
  const candidates = proposableGardens(db);
  const [gardenId, setGardenId] = useState('');
  const [kind, setKind] = useState<AgendaKind>('계획 수립·변경');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = act.addAgenda(gardenId ? { meetingId: m.id, gardenId } : { meetingId: m.id, kind, title });
    if (!r.ok) return setError(r.error);
    setError(null);
    setGardenId('');
    setTitle('');
  };

  return (
    <form onSubmit={submit} className="card space-y-4" noValidate>
      <h2 className="text-xl font-bold">안건 상정</h2>
      <p className="muted text-sm">실무 검수를 통과한 텃밭(심의대기)과 보류된 텃밭을 안건으로 묶어 상정해요. 개회 전에만 상정할 수 있어요.</p>
      <label className="block">
        <span className="mb-1 block font-bold">상정할 텃밭</span>
        <select className="field" value={gardenId} onChange={(e) => setGardenId(e.target.value)}>
          <option value="">{candidates.length ? '텃밭 없이 다른 안건 상정' : '상정할 텃밭이 없어요 (다른 안건만 가능)'}</option>
          {candidates.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} · {g.type} · {g.status === '보류' ? '보류→재상정' : '심의대기'}
            </option>
          ))}
        </select>
      </label>
      {!gardenId && (
        <>
          <label className="block">
            <span className="mb-1 block font-bold">안건 유형</span>
            <select className="field" value={kind} onChange={(e) => setKind(e.target.value as AgendaKind)}>
              <option>상자텃밭 보급</option>
              <option>계획 수립·변경</option>
              <option>기타</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block font-bold">안건 제목</span>
            <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예) 2027년 도시농업 활성화 계획 수립(안)" />
          </label>
        </>
      )}
      <ErrorLine msg={error} />
      <button type="submit" className="btn btn-primary w-full sm:w-auto">안건으로 상정</button>
    </form>
  );
}

// ───────── 안건별 의결 ─────────
function AgendaCard({ a, m, db }: { a: Agenda; m: Meeting; db: Db }) {
  const g = a.gardenId ? getGarden(db, a.gardenId) : undefined;
  const [manual, setManual] = useState(false);
  const [nums, setNums] = useState({ yes: '', no: '', abstain: '' });
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState<'decide' | 'hold' | null>(null);
  const [fix, setFix] = useState('');
  const [error, setError] = useState<string | null>(null);

  const t = tallyVotes(db.votes, a.id, m.attendeeIds);
  const counts = manual
    ? { yes: Number(nums.yes || 0), no: Number(nums.no || 0), abstain: Number(nums.abstain || 0) }
    : { yes: t.yes, no: t.no, abstain: t.abstain };
  const judge = judgeAgenda({ total: m.totalMembers, attendees: m.attendeeCount, ...counts });
  const decided = a.result !== '미의결';
  const votes = db.votes.filter((v) => v.agendaId === a.id && m.attendeeIds.includes(v.memberId));

  const decide = (asHold: boolean) => {
    const r = act.decideAgenda({ agendaId: a.id, asHold, note, manual: manual ? counts : undefined });
    setConfirm(null);
    setError(r.ok ? null : r.error);
  };

  return (
    <article className="card space-y-4" aria-label={a.title}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex flex-wrap items-center gap-2">
            <Badge>{a.kind}</Badge>
            <Badge tone={AGENDA_RESULT[a.result].tone}>{AGENDA_RESULT[a.result].label}</Badge>
            {decided && <span className="inline-flex items-center gap-1 text-sm font-bold text-soil-700"><Lock aria-hidden className="size-4" /> 확정·수정 잠금</span>}
          </p>
          <h3 className="mt-1 text-lg font-extrabold">{a.title}</h3>
          <p className="muted text-sm">{a.summary}</p>
        </div>
        {m.status === '예정' && a.result === '미의결' && (
          <button
            type="button"
            className="btn btn-secondary !min-h-11"
            onClick={() => {
              const r = act.removeAgenda(a.id);
              if (!r.ok) setError(r.error);
            }}
          >
            상정 취소
          </button>
        )}
      </div>

      {g && (
        <p className="text-sm">
          텃밭: <Link to={`/admin/review/${g.id}`}>{g.name}</Link> · {g.type} · {g.dong} · 현재 상태 <Badge tone="info">{g.status}</Badge>
        </p>
      )}

      {m.status === '예정' && <p className="muted">개회하면 위원들이 이 안건에 의견(찬성·반대·보류)을 낼 수 있어요.</p>}

      {m.status !== '예정' && (
        <>
          <dl className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            <Count label="재적" value={m.totalMembers} />
            <Count label="출석" value={m.attendeeCount} />
            <Count label="찬성" value={decided ? a.yes : counts.yes} tone="bg-leaf-100" />
            <Count label="반대" value={decided ? a.no : counts.no} tone="bg-red-100" />
            <Count label="보류" value={decided ? a.abstain : counts.abstain} tone="bg-amber-100" />
            <Count label="미투표" value={decided ? '-' : manual ? '-' : t.notVoted} />
          </dl>

          {!decided && (
            <>
              <details>
                <summary className="min-h-12 py-2 font-bold">위원별 의견 ({votes.length}명 제출)</summary>
                {votes.length === 0 ? (
                  <p className="muted">아직 제출된 의견이 없어요.</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {votes.map((v) => (
                      <li key={v.id} className="flex flex-wrap items-baseline gap-2">
                        <strong>{db.members.find((x) => x.id === v.memberId)?.name}</strong>
                        <Badge tone={CHOICE_TONE[v.choice]}>{v.choice}</Badge>
                        {v.comment && <span className="muted text-sm">“{v.comment}”</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </details>

              {m.status === '진행중' && (
                <div className="space-y-2 rounded-xl border-2 border-dashed border-soil-200 p-3">
                  <p className="text-sm font-bold">시연 도우미 <span className="muted font-normal">— 다른 위원의 투표를 대신 채워요</span></p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn btn-secondary !min-h-11" onClick={() => setError(act.autoVote(a.id, 'yes').ok ? null : '자동 투표를 할 수 없어요.')}>
                      나머지 출석 위원 전원 찬성
                    </button>
                    <button type="button" className="btn btn-secondary !min-h-11" onClick={() => setError(act.autoVote(a.id, 'short').ok ? null : '자동 투표를 할 수 없어요.')}>
                      찬성 1표 부족 (부결 시연)
                    </button>
                  </div>
                </div>
              )}

              <label className="flex min-h-12 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  className="size-5 accent-leaf-700"
                  checked={manual}
                  onChange={(e) => {
                    setManual(e.target.checked);
                    setNums({ yes: String(t.yes), no: String(t.no), abstain: String(t.abstain) });
                  }}
                />
                <span className="font-bold">투표 집계 대신 인원 직접 입력</span>
              </label>
              {manual && (
                <div className="grid grid-cols-3 gap-2">
                  {(['yes', 'no', 'abstain'] as const).map((k) => (
                    <label key={k} className="block">
                      <span className="mb-1 block font-bold">{{ yes: '찬성', no: '반대', abstain: '보류' }[k]}</span>
                      <input className="field" inputMode="numeric" value={nums[k]} onChange={(e) => setNums((n) => ({ ...n, [k]: e.target.value }))} />
                    </label>
                  ))}
                </div>
              )}

              {/* 개회·가결 요건 자동 판정 */}
              <div aria-live="polite" className="space-y-1 rounded-xl bg-soil-100 p-3">
                <p className="font-bold">자동 판정 (조례 제8조)</p>
                <p className="flex items-start gap-2">
                  {judge.quorumMet ? <Check aria-hidden className="mt-1 size-4 shrink-0 text-leaf-800" /> : <X aria-hidden className="mt-1 size-4 shrink-0 text-red-700" />}
                  <span>
                    <strong>개회 요건</strong> 출석 {m.attendeeCount}명 / 재적 {m.totalMembers}명 → 재적 과반({minAttendeesForQuorum(m.totalMembers)}명 이상) {judge.quorumMet ? '충족' : '미달'}
                  </span>
                </p>
                {judge.canDecide && (
                  <p className="flex items-start gap-2">
                    {judge.passed ? <Check aria-hidden className="mt-1 size-4 shrink-0 text-leaf-800" /> : <X aria-hidden className="mt-1 size-4 shrink-0 text-red-700" />}
                    <span>
                      <strong>가결 요건</strong> {judge.reason.replace(/^가결 요건 (충족|미달) — /, '')} → {judge.passed ? '가결 가능' : '부결(또는 보류)'}
                    </span>
                  </p>
                )}
              </div>

              {!judge.canDecide && <Notice tone="warn"><p className="font-bold">의결할 수 없어요</p><p>{judge.reason}</p><p className="text-sm">출석 체크를 마쳐 개회 요건을 갖춘 뒤에 의결해 주세요.</p></Notice>}
              {(
                <>
                  {judge.canDecide && !judge.passed && (
                    <label className="block">
                      <span className="mb-1 block font-bold">부결·보류 사유 (제공자에게 보여요)</span>
                      <textarea className="field min-h-20" value={note} onChange={(e) => setNote(e.target.value)} placeholder="예) 진입로 안전시설 보완 후 재상정" />
                    </label>
                  )}
                  {confirm ? (
                    <div role="group" aria-label="의결 확정 확인" className="space-y-2 rounded-xl bg-amber-100 p-3 text-amber-800">
                      <p className="font-bold">
                        “{confirm === 'hold' ? '보류' : judge.suggested}”로 의결을 확정할까요? 확정하면 수정할 수 없고, 정정은 기록으로만 남길 수 있어요.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="btn btn-primary" onClick={() => decide(confirm === 'hold')}>네, 확정합니다</button>
                        <button type="button" className="btn btn-secondary" onClick={() => setConfirm(null)}>아니요</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button type="button" className="btn btn-primary" disabled={!judge.canDecide || m.status !== '진행중'} onClick={() => setConfirm('decide')}>
                        의결 확정{judge.canDecide ? ` (${judge.suggested})` : ''}
                      </button>
                      {judge.canDecide && !judge.passed && (
                        <button type="button" className="btn btn-secondary" onClick={() => setConfirm('hold')}>
                          부결 대신 보류로 확정
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}

      {decided && (
        <>
          <Notice tone={a.result === '가결' ? 'success' : a.result === '부결' ? 'danger' : 'warn'}>
            <p className="font-bold">
              {a.result} · {formatDate(a.decidedAt ?? m.scheduledAt)} 확정 (찬성 {a.yes} · 반대 {a.no} · 보류 {a.abstain} / 출석 {m.attendeeCount}명)
            </p>
            {g && a.result === '가결' && (
              <p className="text-sm">
                「{g.name}」이(가) <strong>지정</strong>되어 시민 화면에 공개됩니다. <Link to={`/gardens/${g.id}`}>시민 화면에서 보기</Link>
              </p>
            )}
            {g?.reviewNote && a.result !== '가결' && <p className="text-sm">제공자에게 표시되는 사유: {g.reviewNote}</p>}
          </Notice>
          {a.corrections.length > 0 && (
            <div>
              <h4 className="font-bold">정정 기록</h4>
              <ul className="list-disc pl-5">
                {a.corrections.map((c, i) => (
                  <li key={i}>
                    {formatDate(c.at)} · {getUser(db, c.by)?.name} — {c.note}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                const r = act.correctAgenda(a.id, fix);
                if (!r.ok) return setError(r.error);
                setFix('');
                setError(null);
              }}
            >
              <label className="flex-1">
                <span className="sr-only">정정 내용</span>
                <input className="field" value={fix} onChange={(e) => setFix(e.target.value)} placeholder="정정이 필요하면 내용을 적어 기록으로 남겨요 (결과는 바뀌지 않아요)" />
              </label>
              <button type="submit" className="btn btn-secondary">정정 기록 남기기</button>
            </form>
        </>
      )}
      <ErrorLine msg={error} />
    </article>
  );
}

export default function MeetingDetail() {
  const { id = '' } = useParams();
  const db = useDb();
  const { isSecretary, today } = useSession();
  const m = db.meetings.find((x) => x.id === id);
  usePageTitle(m ? meetingLabel(m) : '회의');
  const [error, setError] = useState<string | null>(null);

  if (!isSecretary) return <Notice tone="warn">위원회 관리는 위원회 간사만 이용할 수 있어요.</Notice>;
  if (!m) return <Notice tone="warn">회의를 찾을 수 없어요. <Link to="/admin/committee">회의 목록으로</Link></Notice>;

  const agendas = db.agendas.filter((a) => a.meetingId === m.id);
  const early = m.scheduledAt.slice(0, 10) > today;
  const undecided = agendas.filter((a) => a.result === '미의결').length;

  const open = () => {
    const r = act.openMeeting(m.id);
    setError(r.ok ? null : r.error);
  };
  const close = () => {
    const r = act.closeMeeting(m.id);
    setError(r.ok ? null : r.error);
  };

  return (
    <div className="max-w-4xl space-y-5">
      <Link to="/admin/committee" className="inline-flex min-h-12 items-center gap-1 font-bold">
        <ArrowLeft aria-hidden className="size-5" /> 위원회 관리
      </Link>

      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-extrabold">{meetingLabel(m)}</h1>
          <Badge tone={MEETING_STATUS[m.status].tone}>{MEETING_STATUS[m.status].label}</Badge>
        </div>
        <p className="muted">
          {formatDateTime(m.scheduledAt)} · {m.place} · 재적 {m.totalMembers}명 (조례 제8조: 재적 과반 출석, 출석 과반 찬성)
        </p>
        {m.minutesDoc && <DocList title="회의록 (모의)" files={[m.minutesDoc]} />}
      </header>

      <AttendancePanel m={m} />

      {m.status === '예정' && (
        <section className="card space-y-3 border-leaf-700">
          <h2 className="text-xl font-bold">개회</h2>
          <p>출석 체크를 마쳐 개회 요건(재적 과반 출석)을 갖추면 회의를 열 수 있어요. 개회하면 안건 텃밭이 “심의중”이 되고 위원 투표가 시작돼요.</p>
          {DEMO.allowEarlyMeeting && early && <p className="muted text-sm">예정일({formatDate(m.scheduledAt)})보다 이르지만, 시연을 위해 개회할 수 있게 해 두었어요.</p>}
          <button type="button" className="btn btn-primary w-full sm:w-auto" onClick={open} disabled={!m.quorumMet || (!DEMO.allowEarlyMeeting && early)} aria-describedby="open-why">
            회의 개회
          </button>
          <p id="open-why" className={m.quorumMet ? 'muted text-sm' : 'font-bold text-clay-700'}>
            {m.quorumMet ? `개회 요건 충족 (출석 ${m.attendeeCount}/${m.totalMembers}명)` : `개회 요건 미달 — 재적 과반(${minAttendeesForQuorum(m.totalMembers)}명 이상) 출석이 필요해요. 미달이면 의결을 진행할 수 없어요.`}
          </p>
          <ErrorLine msg={error} />
        </section>
      )}

      {m.status === '예정' && <AddAgendaForm m={m} />}

      <section aria-labelledby="ags" className="space-y-4">
        <h2 id="ags" className="text-xl font-bold">안건 ({agendas.length}건)</h2>
        {agendas.length === 0 ? (
          <div className="card muted">상정된 안건이 없어요.</div>
        ) : (
          agendas.map((a) => <AgendaCard key={a.id} a={a} m={m} db={db} />)
        )}
      </section>

      {m.status === '진행중' && (
        <section className="card space-y-3">
          <h2 className="text-xl font-bold">회의 종료</h2>
          <p className="muted">{undecided > 0 ? `아직 의결하지 않은 안건이 ${undecided}건 있어요.` : '모든 안건이 의결되었어요. 회의를 종료하면 회의록(모의)이 남아요.'}</p>
          <button type="button" className="btn btn-primary w-full sm:w-auto" onClick={close} disabled={undecided > 0}>
            회의 종료
          </button>
          <ErrorLine msg={error} />
        </section>
      )}
    </div>
  );
}
