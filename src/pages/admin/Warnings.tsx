import { AlertTriangle, ArrowRight, Undo2 } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { Badge, KindBadge, Notice } from '../../components/Badge';
import { Field } from '../../components/Field';
import { confirmRecall, issueWarning } from '../../data/warningActions';
import { getUser } from '../../data/selectors';
import { useDb, useSession } from '../../data/useDb';
import { formatDate } from '../../lib/date';
import { WARNING_SOURCES, reasonHasDate, recallPendingPlots, warningLevel, warningsOf, type WarningSource } from '../../lib/warnings';
import { usePageTitle } from '../../lib/usePageTitle';
import type { Db, Plot } from '../../types';

const LEVEL_BADGE = {
  none: null,
  notice: { tone: 'warn', text: (n: number) => `경고 ${n}회` },
  danger: { tone: 'danger', text: (n: number) => `경고 ${n}회 · 회수 직전` },
  recall: { tone: 'danger', text: (n: number) => `경고 ${n}회 · 회수 대상` },
} as const;

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="card">
      <p className="muted text-sm font-bold">{label}</p>
      <p className="text-3xl font-extrabold text-leaf-800">{value}</p>
      {hint && <p className="muted text-sm">{hint}</p>}
    </div>
  );
}

const plotLabel = (db: Db, p: Plot) => `${db.gardens.find((g) => g.id === p.gardenId)?.name} ${p.number}번`;

function WarningBadge({ db, plot }: { db: Db; plot: Plot }) {
  const b = LEVEL_BADGE[warningLevel(plot.warningCount, db.settings.warningLimit)];
  return b ? <Badge tone={b.tone}>{b.text(plot.warningCount)}</Badge> : <Badge tone="neutral">경고 없음</Badge>;
}

/** 회수 대상: 경고 3회 누적. 관리자가 확정하면 구획이 공실로 돌아가고 대기자에게 승계된다. */
function RecallCard({ plot, db, onDone }: { plot: Plot; db: Db; onDone: (msg: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = getUser(db, plot.userId!);
  const garden = db.gardens.find((g) => g.id === plot.gardenId)!;
  const list = warningsOf(db, plot.id, plot.userId);
  const waiting = db.applications.filter((a) => a.status === '대기' && a.waitlist?.some((w) => w.gardenId === plot.gardenId)).length;

  const confirm = () => {
    const r = confirmRecall(plot.id);
    if (!r.ok) return setError(r.error);
    const heir = r.value?.promotedTo ? db.applications.find((a) => a.id === r.value!.promotedTo) : null;
    const heirName = heir ? getUser(db, heir.userId)?.name : null;
    onDone(
      heirName
        ? `${plotLabel(db, plot)} 회수를 확정했어요. 대기 1번 ${heirName}님에게 구획이 승계되었어요. (수락 기한 안내 발송)`
        : `${plotLabel(db, plot)} 회수를 확정했어요. 대기자가 없어 빈 구획으로 남아요 — 재모집이 필요해요.`,
    );
  };

  return (
    <article className="card space-y-3 border-red-700" aria-label={`${plotLabel(db, plot)} 회수 대상`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-extrabold">
            {garden.name} · {plot.number}번 구획
          </h3>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <KindBadge kind={garden.type} /> <span>이용자 <strong>{user?.name}</strong></span>
          </p>
        </div>
        <Badge tone="danger">회수 대상 · 경고 {plot.warningCount}회</Badge>
      </div>
      <ol className="space-y-1 border-l-4 border-red-100 pl-3 text-sm">
        {list.map((w, i) => (
          <li key={w.id}>
            <strong>{i + 1}회</strong> · {reasonHasDate(w) ? w.reason : `${formatDate(w.issuedAt)} — ${w.reason}`}
          </li>
        ))}
      </ol>
      <p className="text-sm">
        회수를 확정하면 구획이 공실로 돌아가고 <strong>대기자 {waiting}명</strong> 중 대기번호가 가장 빠른 분에게 {waiting > 0 ? '승계돼요' : '넘길 수 없어 재모집이 필요해요'}.
      </p>
      {confirming ? (
        <div role="group" aria-label="회수 확정 확인" className="space-y-2 rounded-xl bg-amber-100 p-3 text-amber-800">
          <p className="font-bold">{user?.name}님의 구획 회수를 확정할까요? 되돌릴 수 없어요.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-danger" onClick={confirm}>
              네, 회수를 확정합니다
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)}>
              아니요
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-danger w-full sm:w-auto" onClick={() => setConfirming(true)}>
          <Undo2 aria-hidden className="size-5" /> 회수 확정
        </button>
      )}
      {error && (
        <p role="alert" className="font-bold text-red-700">
          {error}
        </p>
      )}
    </article>
  );
}

function IssueForm({ db, plotId, setPlotId, onResult }: { db: Db; plotId: string; setPlotId: (id: string) => void; onResult: (msg: string, tone: 'success' | 'warn') => void }) {
  const { today } = useSession();
  const [reason, setReason] = useState('');
  const [source, setSource] = useState<WarningSource>('현장 점검');
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  const occupied = db.plots.filter((p) => p.status === '이용중' && p.userId).sort((a, b) => a.gardenId.localeCompare(b.gardenId) || a.number - b.number);
  const plot = occupied.find((p) => p.id === plotId);
  const limit = db.settings.warningLimit;
  const willRecall = !!plot && plot.warningCount + 1 >= limit;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!plot) return setError('경고를 줄 이용자(구획)를 선택해 주세요.');
    const r = issueWarning({ plotId: plot.id, reason, source, inspectedAt: date });
    if (!r.ok) {
      setError(r.error);
      if (r.error.includes('사유')) reasonRef.current?.focus();
      return;
    }
    setError(null);
    setReason('');
    const who = getUser(db, plot.userId!)?.name;
    onResult(
      r.value?.recallPending
        ? `${who}님에게 경고 ${r.value.count}회를 부여했어요. ${limit}회에 도달해 회수 대상이 되었어요 — 위의 “회수 대기”에서 확정해 주세요.`
        : `${who}님에게 경고 ${r.value?.count}회를 부여했어요. 이용자 화면에 경고 배너와 사유가 표시돼요.`,
      r.value?.recallPending ? 'warn' : 'success',
    );
  };

  return (
    <form id="issue" onSubmit={submit} className="card space-y-4" noValidate>
      <h2 className="text-xl font-bold">경고 부여</h2>
      <p className="muted text-sm">미경작 점검(또는 신고 확인) 결과를 기록해 경고를 줘요. <strong>사유는 필수</strong>이며 이용자 화면에 그대로 보여요.</p>
      <Field label="이용자 · 구획" required>
        {(p) => (
          <select {...p} className="field" value={plotId} onChange={(e) => { setPlotId(e.target.value); setError(null); }}>
            <option value="">이용자를 선택하세요</option>
            {occupied.map((o) => (
              <option key={o.id} value={o.id}>
                {plotLabel(db, o)} · {getUser(db, o.userId!)?.name} · 경고 {o.warningCount}회
              </option>
            ))}
          </select>
        )}
      </Field>
      {willRecall && (
        <Notice tone="warn">
          <p className="font-bold">이번 경고로 회수 대상이 돼요</p>
          <p className="text-sm">
            {getUser(db, plot!.userId!)?.name}님은 이미 경고 {plot!.warningCount}회예요. {limit}번째 경고를 주면 구획이 “회수대기”가 되고, 회수 확정 후 대기자에게 승계돼요.
          </p>
        </Notice>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="확인 경로">
          {(p) => (
            <select {...p} className="field" value={source} onChange={(e) => setSource(e.target.value as WarningSource)}>
              {WARNING_SOURCES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="점검(확인)일" required>
          {(p) => <input {...p} type="date" className="field" value={date} max={today} onChange={(e) => setDate(e.target.value)} />}
        </Field>
      </div>
      <Field label="경고 사유" required error={error?.includes('사유') ? error : undefined} hint="예) 잡초가 무성하고 3주 넘게 작물을 돌보지 않은 상태로 확인됨">
        {(p) => <textarea {...p} ref={reasonRef} className="field min-h-24" value={reason} onChange={(e) => setReason(e.target.value)} />}
      </Field>
      {error && !error.includes('사유') && (
        <p role="alert" className="rounded-lg bg-red-100 p-3 font-bold text-red-700">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary w-full sm:w-auto">
        <AlertTriangle aria-hidden className="size-5" /> 경고 부여
      </button>
    </form>
  );
}

export default function Warnings() {
  usePageTitle('경고·회수 관리');
  const db = useDb();
  const limit = db.settings.warningLimit;
  const [plotId, setPlotId] = useState('');
  const [notice, setNotice] = useState<{ msg: string; tone: 'success' | 'warn' } | null>(null);

  const pending = recallPendingPlots(db);
  const warned = db.plots.filter((p) => p.userId && p.warningCount > 0).sort((a, b) => b.warningCount - a.warningCount || a.gardenId.localeCompare(b.gardenId) || a.number - b.number);
  const history = db.warnings.slice().sort((a, b) => b.issuedAt.localeCompare(a.issuedAt) || b.id.localeCompare(a.id));
  const recalls = db.successions.filter((s) => s.reason === '회수').slice().reverse();
  const gname = (id: string) => db.gardens.find((g) => g.id === id)?.name ?? id;

  const pick = (id: string) => {
    setPlotId(id);
    document.getElementById('issue')?.scrollIntoView({ block: 'start' });
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">경고·회수 관리</h1>
        <p className="muted">
          미경작 점검 결과로 경고를 부여하고, 경고 <strong>{limit}회</strong>가 쌓이면 회수 대상이 돼요. 회수를 확정하면 구획이 공실로 돌아가고 대기자에게 승계돼요. (회수 기준은 조례에 없어 운영지침으로 정하는 설정값이에요)
        </p>
      </div>

      <section aria-label="요약" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="회수 대기" value={pending.length} hint="회수 확정이 필요해요" />
        <Stat label={`경고 ${limit - 1}회 (회수 직전)`} value={warned.filter((p) => p.status === '이용중' && p.warningCount === limit - 1).length} hint="한 번 더 받으면 회수" />
        <Stat label="경고를 받은 이용자" value={warned.length} />
        <Stat label="이용 중 구획" value={db.plots.filter((p) => p.status === '이용중').length} />
      </section>

      {notice && <Notice tone={notice.tone}><p className="font-bold">{notice.msg}</p></Notice>}

      <section aria-labelledby="recall" className="space-y-3">
        <h2 id="recall" className="text-xl font-bold">
          회수 대기 <span className="text-red-700">{pending.length}건</span>
        </h2>
        {pending.length === 0 ? (
          <div className="card muted">회수를 기다리는 구획이 없어요. 경고가 {limit}회에 도달하면 여기에 나타나요.</div>
        ) : (
          pending.map((p) => <RecallCard key={p.id} plot={p} db={db} onDone={(msg) => setNotice({ msg, tone: 'success' })} />)
        )}
      </section>

      <IssueForm db={db} plotId={plotId} setPlotId={setPlotId} onResult={(msg, tone) => setNotice({ msg, tone })} />

      <section aria-labelledby="warned" className="space-y-3">
        <h2 id="warned" className="text-xl font-bold">경고를 받은 이용자</h2>
        <div className="card overflow-x-auto !p-0" role="region" tabIndex={0} aria-label="경고를 받은 이용자">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">경고를 받은 이용자</caption>
            <thead>
              <tr className="border-b-2 border-soil-200">
                {['이용자', '텃밭 · 구획', '경고', '마지막 경고', ''].map((h, i) => (
                  <th key={i} scope="col" className="px-3 py-2">{h || <span className="sr-only">작업</span>}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {warned.map((p) => {
                const last = warningsOf(db, p.id, p.userId).at(-1);
                return (
                  <tr key={p.id} className="border-b border-soil-200">
                    <th scope="row" className="px-3 py-2">{getUser(db, p.userId!)?.name}</th>
                    <td className="px-3 py-2">{plotLabel(db, p)}</td>
                    <td className="px-3 py-2"><WarningBadge db={db} plot={p} /></td>
                    <td className="px-3 py-2">{last ? formatDate(last.issuedAt) : '-'}</td>
                    <td className="px-3 py-2">
                      {p.status === '이용중' && (
                        <button type="button" className="btn btn-secondary !min-h-10 !px-3 !py-0" onClick={() => pick(p.id)} aria-label={`${getUser(db, p.userId!)?.name} 경고 부여하기`}>
                          경고 부여
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {warned.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center muted">경고를 받은 이용자가 없어요.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="hist" className="space-y-3">
        <h2 id="hist" className="text-xl font-bold">경고 이력</h2>
        <div className="card overflow-x-auto !p-0" role="region" tabIndex={0} aria-label="경고 이력">
          <table className="w-full min-w-[46rem] text-left text-sm">
            <caption className="sr-only">경고 이력</caption>
            <thead>
              <tr className="border-b-2 border-soil-200">
                {['일자', '이용자', '텃밭 · 구획', '사유', '부여자'].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((w) => {
                const p = db.plots.find((x) => x.id === w.plotId);
                return (
                  <tr key={w.id} className="border-b border-soil-200 align-top">
                    <td className="px-3 py-2">{formatDate(w.issuedAt)}</td>
                    <td className="px-3 py-2">{getUser(db, w.userId)?.name}</td>
                    <td className="px-3 py-2">{p ? plotLabel(db, p) : w.plotId}</td>
                    <td className="px-3 py-2">{w.reason}</td>
                    <td className="px-3 py-2">{getUser(db, w.issuedBy)?.name}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="recalled" className="space-y-3">
        <h2 id="recalled" className="text-xl font-bold">회수 확정 내역</h2>
        {recalls.length === 0 ? (
          <div className="card muted">아직 회수를 확정한 구획이 없어요.</div>
        ) : (
          <ul className="space-y-2">
            {recalls.map((s) => (
              <li key={s.id} className="card flex flex-wrap items-center gap-x-3 gap-y-1 !py-3">
                <span className="muted text-sm">{formatDate(s.at)}</span>
                <strong>{gname(s.gardenId)}</strong>
                <span>{getUser(db, s.fromUserId)?.name}</span>
                <ArrowRight aria-hidden className="size-4" />
                {s.toUserId ? <strong>{getUser(db, s.toUserId)?.name} (대기 승계)</strong> : <Badge tone="danger">대기자 없음 · 재모집 필요</Badge>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
