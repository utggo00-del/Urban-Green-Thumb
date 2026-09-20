import { CalendarClock, Lock, Play, Square, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Badge, KindBadge, Notice } from '../../components/Badge';
import { Field } from '../../components/Field';
import * as act from '../../data/allocationActions';
import { currentSeasonKey, isPublished, nextMeeting, seasonKeyOf } from '../../data/selectors';
import { useDb, useSession } from '../../data/useDb';
import { dDayLabel, formatDate, formatDateTime } from '../../lib/date';
import { RECRUITMENT_STATUS } from '../../lib/labels';
import { meetingLabel } from '../../lib/meeting';
import { openBlockReason, recruitmentDefaults, seasonWindowNote, vacantPlotCount } from '../../lib/recruitment';
import { usePageTitle } from '../../lib/usePageTitle';
import type { Db, Recruitment, SeasonKey, SeasonName } from '../../types';

const pct = (r: number) => `${Math.round(r * 100)}%`;

function ErrorLine({ msg }: { msg: string | null }) {
  return msg ? (
    <p role="alert" className="rounded-lg bg-red-100 p-3 font-bold text-red-700">
      {msg}
    </p>
  ) : null;
}

function EditForm({ r, onDone }: { r: Recruitment; onDone: () => void }) {
  const [start, setStart] = useState(r.applyStart);
  const [end, setEnd] = useState(r.applyEnd);
  const [draw, setDraw] = useState(r.drawDate);
  const [plots, setPlots] = useState(String(r.plotsOffered));
  const [ratio, setRatio] = useState(String(Math.round(r.priorityQuotaRatio * 100)));
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const res = act.updateRecruitment(r.id, { applyStart: start, applyEnd: end, drawDate: draw, plotsOffered: Number(plots), priorityQuotaRatio: Number(ratio) / 100 });
    if (!res.ok) return setError(res.error);
    onDone();
  };
  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border-2 border-soil-200 p-3" noValidate>
      <h4 className="font-extrabold">모집 설정 수정</h4>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="신청 시작일">{(p) => <input {...p} type="date" className="field" value={start} onChange={(e) => setStart(e.target.value)} />}</Field>
        <Field label="신청 마감일">{(p) => <input {...p} type="date" className="field" value={end} onChange={(e) => setEnd(e.target.value)} />}</Field>
        <Field label="추첨일">{(p) => <input {...p} type="date" className="field" value={draw} onChange={(e) => setDraw(e.target.value)} />}</Field>
        <Field label="모집 구획 수">{(p) => <input {...p} className="field" inputMode="numeric" value={plots} onChange={(e) => setPlots(e.target.value)} />}</Field>
        <Field label="우선 배정 몫 (%)" hint="정책에 따라 조정할 수 있어요. 기본 30%">
          {(p) => <input {...p} className="field" inputMode="numeric" value={ratio} onChange={(e) => setRatio(e.target.value)} />}
        </Field>
      </div>
      <ErrorLine msg={error} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary">저장</button>
        <button type="button" className="btn btn-secondary" onClick={onDone}>닫기</button>
      </div>
    </form>
  );
}

function RecruitmentCard({ r, db }: { r: Recruitment; db: Db }) {
  const { today } = useSession();
  const g = db.gardens.find((x) => x.id === r.gardenId)!;
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const season = seasonKeyOf(r);
  const applicants = db.applications.filter((a) => a.recruitmentSeason === season && a.status !== '취소' && a.choices.includes(r.gardenId)).length;
  const st = RECRUITMENT_STATUS[r.status];
  const call = (res: { ok: boolean; error?: string }) => setError(res.ok ? null : (res as { error: string }).error);

  return (
    <article className="card space-y-3" aria-label={g.name}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-extrabold">{g.name}</h3>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <KindBadge kind={g.type} /> <span className="muted">{g.ordinanceType} · {g.dong}</span>
          </p>
        </div>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
        {[
          ['신청 기간', `${formatDate(r.applyStart)} ~ ${formatDate(r.applyEnd)}`],
          ['추첨일', formatDate(r.drawDate)],
          ['모집 구획', `${r.plotsOffered}개 (빈 구획 ${vacantPlotCount(db, r.gardenId)}개)`],
          ['우선 배정 몫', pct(r.priorityQuotaRatio)],
          ['지망 신청', `${applicants}명`],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="muted">{k}</dt>
            <dd className="font-bold">{v}</dd>
          </div>
        ))}
      </dl>
      {r.status === '모집중' && (
        <p className="flex items-start gap-1.5 text-sm">
          <CalendarClock aria-hidden className="mt-1 size-4 shrink-0" />
          <span>
            마감까지 <strong>{dDayLabel(r.applyEnd, today)}</strong>
          </span>
        </p>
      )}

      {(r.status === '준비' || r.status === '모집중') && (
        <div className="flex flex-wrap gap-2">
          {r.status === '준비' && (
            <button type="button" className="btn btn-primary !min-h-11" onClick={() => call(act.startRecruitment(r.id))}>
              <Play aria-hidden className="size-4" /> 모집 시작
            </button>
          )}
          {r.status === '모집중' && (
            <button type="button" className="btn btn-primary !min-h-11" onClick={() => call(act.closeRecruitment(r.id))}>
              <Square aria-hidden className="size-4" /> 모집 마감
            </button>
          )}
          <button type="button" className="btn btn-secondary !min-h-11" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
            설정 수정
          </button>
          {r.status === '준비' && (
            <button type="button" className="btn btn-secondary !min-h-11" onClick={() => call(act.removeRecruitment(r.id))}>
              <Trash2 aria-hidden className="size-4" /> 삭제
            </button>
          )}
        </div>
      )}
      {r.status === '마감' && (
        <p className="flex flex-wrap items-center gap-2">
          <Lock aria-hidden className="size-4" /> 모집이 마감되었어요. <Link to="/admin/draw" className="font-bold">추첨 실행으로 이동</Link>
        </p>
      )}
      {r.status === '추첨완료' && <p className="muted">추첨이 끝났어요. 결과는 <Link to="/admin/allocations">분양·이용자 관리</Link>에서 확인하세요.</p>}
      {editing && <EditForm r={r} onDone={() => setEditing(false)} />}
      <ErrorLine msg={error} />
    </article>
  );
}

function NewRecruitmentForm({ season, db }: { season: SeasonKey; db: Db }) {
  const [year, sName] = [Number(season.slice(0, 4)), season.slice(5) as SeasonName];
  const defaults = recruitmentDefaults(db, sName, year);
  const taken = new Set(db.recruitments.filter((r) => seasonKeyOf(r) === season).map((r) => r.gardenId));
  const candidates = db.gardens.filter((g) => !taken.has(g.id));
  const published = candidates.filter(isPublished);
  const unpublished = candidates.filter((g) => !isPublished(g));

  const [gardenId, setGardenId] = useState('');
  const [start, setStart] = useState(defaults.applyStart);
  const [end, setEnd] = useState(defaults.applyEnd);
  const [draw, setDraw] = useState(defaults.drawDate);
  const [plots, setPlots] = useState('');
  const [ratio, setRatio] = useState(String(Math.round(defaults.priorityQuotaRatio * 100)));
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const blocked = gardenId ? openBlockReason(db, gardenId) : null;
  const vacant = gardenId ? vacantPlotCount(db, gardenId) : 0;
  const windowNote = seasonWindowNote(db, sName, start, end);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setDone(null);
    const res = act.openRecruitment({
      gardenId, year, season: sName, applyStart: start, applyEnd: end, drawDate: draw,
      plotsOffered: Number(plots || vacant), priorityQuotaRatio: Number(ratio) / 100, acceptDeadlineDays: defaults.acceptDeadlineDays,
    });
    if (!res.ok) return setError(res.error);
    setError(null);
    setDone(db.gardens.find((g) => g.id === gardenId)?.name ?? '');
    setGardenId('');
    setPlots('');
  };

  return (
    <form onSubmit={submit} className="card space-y-4" noValidate>
      <h2 className="text-xl font-bold">새 모집 개설 <span className="muted text-base font-normal">({season.replace('-', ' ')} 시즌)</span></h2>
      <p className="muted text-sm">위원회 심의를 거쳐 <strong>지정된 텃밭만</strong> 모집을 열 수 있어요.</p>
      <Field label="텃밭" required>
        {(p) => (
          <select {...p} className="field" value={gardenId} onChange={(e) => { setGardenId(e.target.value); setError(null); setDone(null); }}>
            <option value="">텃밭을 선택하세요</option>
            <optgroup label="지정 완료 (모집 가능)">
              {published.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} · 빈 구획 {vacantPlotCount(db, g.id)}개
                </option>
              ))}
            </optgroup>
            {unpublished.length > 0 && (
              <optgroup label="지정 전 (모집 불가)">
                {unpublished.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} · {g.status}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        )}
      </Field>
      {blocked && (
        <Notice tone="warn">
          <p className="font-bold">모집을 열 수 없어요</p>
          <p>{blocked}</p>
          <p className="mt-1 text-sm">
            <Link to="/admin/committee">위원회 관리</Link>에서 안건으로 상정해 심의를 받으면 모집할 수 있어요.
          </p>
        </Notice>
      )}
      {!blocked && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="신청 시작일" required>{(p) => <input {...p} type="date" className="field" value={start} onChange={(e) => setStart(e.target.value)} />}</Field>
            <Field label="신청 마감일" required>{(p) => <input {...p} type="date" className="field" value={end} onChange={(e) => setEnd(e.target.value)} />}</Field>
            <Field label="추첨일" required>{(p) => <input {...p} type="date" className="field" value={draw} onChange={(e) => setDraw(e.target.value)} />}</Field>
            <Field label="모집 구획 수" required hint={gardenId ? `빈 구획 ${vacant}개까지 모집할 수 있어요. 비우면 전부 모집해요.` : undefined}>
              {(p) => <input {...p} className="field" inputMode="numeric" value={plots} onChange={(e) => setPlots(e.target.value)} placeholder={gardenId ? String(vacant) : ''} />}
            </Field>
            <Field label="우선 배정 몫 (%)" hint="전체 구획 중 다자녀·취약계층·노인 우선 몫. 정책에 따라 조정할 수 있어요.">
              {(p) => <input {...p} className="field" inputMode="numeric" value={ratio} onChange={(e) => setRatio(e.target.value)} />}
            </Field>
          </div>
          {windowNote && <p className="rounded-lg bg-amber-100 p-3 text-amber-800">{windowNote}</p>}
        </>
      )}
      <ErrorLine msg={error} />
      {done && <Notice tone="success">「{done}」 모집을 “모집 준비” 상태로 만들었어요. 아래 목록에서 모집을 시작하세요.</Notice>}
      <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={!gardenId || !!blocked}>
        모집 개설
      </button>
    </form>
  );
}

export default function Recruitments() {
  usePageTitle('모집 관리');
  const db = useDb();
  const { today } = useSession();
  const seasons = [...new Set([currentSeasonKey(db), ...db.recruitments.map(seasonKeyOf)])].sort().reverse();
  const [season, setSeason] = useState<SeasonKey>(currentSeasonKey(db));
  const list = db.recruitments.filter((r) => seasonKeyOf(r) === season).sort((a, b) => a.applyEnd.localeCompare(b.applyEnd) || a.gardenId.localeCompare(b.gardenId));
  const meeting = nextMeeting(db);
  const half = db.settings.seasonMeetingLink;
  const sName = season.slice(5) as SeasonName;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">모집 관리</h1>
        <p className="muted">시즌(봄·가을)과 텃밭별 모집 기간을 정하고 상태(준비 → 모집중 → 마감 → 추첨완료)를 관리해요. 모집은 연 2회예요.</p>
      </div>

      <Notice tone="info">
        <p className="font-bold">모집 시즌과 위원회 정례회의</p>
        <p className="text-sm">
          기본 시나리오: 봄 모집은 <strong>{half.봄} 정례회의</strong>, 가을 모집은 <strong>{half.가을} 정례회의</strong>에서 지정된 텃밭을 중심으로 운영해요. 임시회의로 지정된 텃밭은 시즌 중에도 추가로 모집을 열 수 있어요. (설정으로 조정 가능)
        </p>
        {meeting && (
          <p className="mt-1 text-sm">
            다음 위원회 회의: <strong>{meetingLabel(meeting)}</strong> · {formatDateTime(meeting.scheduledAt)} ({dDayLabel(meeting.scheduledAt.slice(0, 10), today)}) — 여기서 지정된 텃밭은 {meeting.half === db.settings.seasonMeetingLink.봄 ? '봄' : '다음'} 시즌 모집에 쓸 수 있어요.
          </p>
        )}
      </Notice>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 font-bold">
          시즌
          <select className="field !w-auto" value={season} onChange={(e) => setSeason(e.target.value as SeasonKey)}>
            {seasons.map((s) => (
              <option key={s} value={s}>
                {s.replace('-', ' ')}
              </option>
            ))}
          </select>
        </label>
        <span className="muted">
          모집 {list.length}곳 · 모집중 {list.filter((r) => r.status === '모집중').length} · 마감 {list.filter((r) => r.status === '마감').length} · 추첨완료 {list.filter((r) => r.status === '추첨완료').length}
        </span>
      </div>

      <section aria-label={`${season} 모집 목록`} className="grid gap-4 lg:grid-cols-2">
        {list.length === 0 ? <div className="card muted lg:col-span-2">이 시즌의 모집이 아직 없어요.</div> : list.map((r) => <RecruitmentCard key={r.id} r={r} db={db} />)}
      </section>

      {season === currentSeasonKey(db) && sName && <NewRecruitmentForm key={season} season={season} db={db} />}
    </div>
  );
}
