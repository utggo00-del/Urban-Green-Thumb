import { CheckCheck, Dices, ShieldCheck, Trash2 } from 'lucide-react';
import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, KindBadge, Notice } from '../../components/Badge';
import * as act from '../../data/allocationActions';
import { currentSeasonKey, getUser } from '../../data/selectors';
import { useDb } from '../../data/useDb';
import { suggestSeed, unverifiedPriority } from '../../lib/allocation';
import { formatDateTime } from '../../lib/date';
import { prioritySeats } from '../../lib/draw';
import { RECRUITMENT_STATUS } from '../../lib/labels';
import { drawGroups, type DrawGroupInfo } from '../../lib/recruitment';
import { usePageTitle } from '../../lib/usePageTitle';
import type { Db, DrawLog } from '../../types';

const STATE_BADGE = {
  ready: { label: '추첨 가능', tone: 'success' },
  blocked: { label: '대기 (모집 진행 중)', tone: 'warn' },
  pending: { label: '결과 확정 대기', tone: 'info' },
  done: { label: '추첨 완료', tone: 'neutral' },
} as const;

const LOG_STATUS_TONE = { 확정: 'success', 미확정: 'info', 폐기: 'neutral' } as const;

function ErrorLine({ msg }: { msg: string | null }) {
  return msg ? (
    <p role="alert" className="rounded-lg bg-red-100 p-3 font-bold text-red-700">
      {msg}
    </p>
  ) : null;
}

const nameOf = (db: Db, id: string) => db.gardens.find((g) => g.id === id)?.name ?? id;
const userName = (db: Db, id: string) => getUser(db, id)?.name ?? id;

/** 추첨 결과(스냅샷)를 사람이 읽을 수 있게 */
function Snapshot({ log, db }: { log: DrawLog; db: Db }) {
  const wins = log.resultSnapshot.filter((r) => r.result === '당첨');
  const waits = log.resultSnapshot.filter((r) => r.result === '대기').sort((a, b) => (a.waitlistNo ?? 0) - (b.waitlistNo ?? 0));
  const lost = log.resultSnapshot.filter((r) => r.result === '낙첨');
  const groupLabel = { 우선: '우선 몫', 일반: '일반 추첨', 전원: '무추첨' } as const;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div>
        <h5 className="font-bold">당첨 {wins.length}명</h5>
        <ul className="text-sm">
          {wins.map((r) => (
            <li key={r.applicationId}>
              {userName(db, r.userId)} <span className="muted">· {r.choiceRank}지망{r.group ? ` · ${groupLabel[r.group]}` : ''}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h5 className="font-bold">대기 {waits.length}명</h5>
        <ol className="text-sm">
          {waits.map((r) => (
            <li key={r.applicationId}>
              {r.waitlistNo}번 {userName(db, r.userId)} <span className="muted">· {r.choiceRank}지망</span>
            </li>
          ))}
        </ol>
      </div>
      <div>
        <h5 className="font-bold">낙첨 {lost.length}명</h5>
        <ul className="text-sm">
          {lost.map((r) => (
            <li key={r.applicationId}>{userName(db, r.userId)}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PendingResult({ group, db }: { group: DrawGroupInfo; db: Db }) {
  const logs = db.drawLogs.filter((l) => l.groupId === group.id && l.status === '미확정');
  const [reason, setReason] = useState('');
  const [discarding, setDiscarding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3 rounded-xl border-2 border-leaf-700 p-3">
      <h4 className="text-lg font-extrabold">추첨 결과 요약 <span className="muted text-sm font-normal">(아직 시민에게 공개되지 않았어요)</span></h4>
      <p className="text-sm">시드값 <strong>{logs[0]?.seed}</strong> · 실행 {logs[0] && formatDateTime(logs[0].executedAt)}</p>
      {logs.map((l) => {
        const count = (r: string) => l.resultSnapshot.filter((x) => x.result === r).length;
        const byGroup = (g: string) => l.resultSnapshot.filter((x) => x.result === '당첨' && x.group === g).length;
        return (
          <section key={l.id} aria-label={nameOf(db, l.gardenId)} className="space-y-2 rounded-lg bg-leaf-50 p-3">
            <p className="flex flex-wrap items-center gap-2 font-bold">
              {nameOf(db, l.gardenId)} <Badge tone={l.note === '추첨' ? 'warn' : 'success'}>{l.note}</Badge>
            </p>
            <dl className="grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
              {[
                ['대상 신청자', l.applicantCount],
                ['모집 구획', l.plotCount],
                ['당첨', count('당첨')],
                ['대기', count('대기')],
                ['낙첨', count('낙첨')],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-paper p-2">
                  <dt className="muted text-sm">{k}</dt>
                  <dd className="text-xl font-extrabold">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm">
              당첨 경로: 우선 몫 {byGroup('우선')}명 · 일반 추첨 {byGroup('일반')}명 · 무추첨 {byGroup('전원')}명 (우선 배정 대상 {l.priorityGroupCount}명 참여)
            </p>
            <details>
              <summary className="min-h-11 py-2 font-bold">명단 보기</summary>
              <Snapshot log={l} db={db} />
            </details>
          </section>
        );
      })}

      {discarding ? (
        <div className="space-y-2 rounded-xl bg-amber-100 p-3 text-amber-800">
          <label className="block">
            <span className="mb-1 block font-bold">폐기 사유 (감사 로그에 남아요)</span>
            <input className="field text-ink" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예) 시드값을 잘못 입력했습니다." />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                const r = act.discardDraw(group.id, reason);
                if (!r.ok) setError(r.error);
              }}
            >
              추첨 폐기
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setDiscarding(false)}>취소</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              const r = act.confirmDraw(group.id);
              if (!r.ok) setError(r.error);
            }}
          >
            <CheckCheck aria-hidden className="size-5" /> 확정·발표
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setDiscarding(true)}>
            <Trash2 aria-hidden className="size-5" /> 폐기하고 다시 추첨
          </button>
        </div>
      )}
      <p className="muted text-sm">확정·발표하면 신청자의 결과가 시민 화면에 공개되고 구획이 배정돼요. 당첨자에게는 수락 기한이 적용돼요.</p>
      <ErrorLine msg={error} />
    </div>
  );
}

function GroupCard({ group, db }: { group: DrawGroupInfo; db: Db }) {
  const [seed, setSeed] = useState(String(suggestSeed(db)));
  const [error, setError] = useState<string | null>(null);
  const badge = STATE_BADGE[group.state];
  const pendingPriority = unverifiedPriority(group.applications);
  const perGarden = group.recruitments.map((r) => {
    const g = db.gardens.find((x) => x.id === r.gardenId)!;
    const total = group.applications.filter((a) => a.choices.includes(r.gardenId)).length;
    const first = group.applications.filter((a) => a.choices[0] === r.gardenId).length;
    return { r, g, total, first, quota: prioritySeats(r.plotsOffered, r.priorityQuotaRatio) };
  });

  return (
    <article className="card space-y-4" aria-label={group.gardenIds.map((id) => nameOf(db, id)).join(', ')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-extrabold">{group.gardenIds.map((id) => nameOf(db, id)).join(' · ')}</h3>
          <p className="muted text-sm">
            신청 {group.applications.length}건 · 모집 구획 {group.totalPlots}개{group.gardenIds.length > 1 ? ` · 지망이 서로 얽힌 텃밭 ${group.gardenIds.length}곳을 함께 추첨` : ''}
          </p>
        </div>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </div>

      <div className="overflow-x-auto" role="region" tabIndex={0} aria-label="텃밭별 신청자와 구획">
        <table className="w-full min-w-[34rem] text-left">
          <caption className="sr-only">텃밭별 신청자와 구획</caption>
          <thead>
            <tr className="border-b-2 border-soil-200 text-sm">
              <th scope="col" className="py-2 pr-3">텃밭</th>
              <th scope="col" className="py-2 pr-3">모집 구획</th>
              <th scope="col" className="py-2 pr-3">지망 신청(1지망)</th>
              <th scope="col" className="py-2 pr-3">우선 몫</th>
              <th scope="col" className="py-2">모집 상태</th>
            </tr>
          </thead>
          <tbody>
            {perGarden.map(({ r, g, total, first, quota }) => (
              <tr key={r.id} className="border-b border-soil-200">
                <th scope="row" className="py-2 pr-3">
                  <span className="mr-2 font-bold">{g.name}</span>
                  <KindBadge kind={g.type} />
                </th>
                <td className="py-2 pr-3">{r.plotsOffered}개</td>
                <td className="py-2 pr-3">
                  {total}명 ({first}명){' '}
                  <span className="muted text-sm">
                    {first > r.plotsOffered ? '· 1지망만으로 경쟁' : total > r.plotsOffered ? '· 지망에 따라 경쟁 가능' : '· 전원 배정 가능'}
                  </span>
                </td>
                <td className="py-2 pr-3">{quota}석 ({Math.round(r.priorityQuotaRatio * 100)}%)</td>
                <td className="py-2">
                  <Badge tone={RECRUITMENT_STATUS[r.status].tone}>{RECRUITMENT_STATUS[r.status].label}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {group.state === 'blocked' && (
        <Notice tone="warn">
          <p className="font-bold">아직 추첨할 수 없어요</p>
          <p className="text-sm">
            같은 신청서에 함께 적힌 텃밭의 모집이 끝나야 지망 순서대로 공정하게 추첨할 수 있어요. 남은 텃밭:{' '}
            {group.blockedBy.map((b) => `${nameOf(db, b.gardenId)}(${RECRUITMENT_STATUS[b.status].label})`).join(', ')}. <Link to="/admin/recruitments">모집 관리</Link>
          </p>
        </Notice>
      )}

      {group.state === 'ready' && (
        <>
          {pendingPriority.length > 0 && (
            <div className="rounded-xl bg-amber-100 p-3 text-amber-800">
              <p className="font-bold">우선 배정 자기신고 확인 대기 {pendingPriority.length}명</p>
              <p className="text-sm">확인하지 않은 신고는 우선 몫 추첨에 들어가지 않고 일반 그룹으로 추첨돼요. (증빙 확인은 모의 처리)</p>
              <ul className="mt-2 space-y-1">
                {pendingPriority.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {userName(db, a.userId)} · {a.priorityType}
                      {a.appliedBy === '관리자대리' && ' · 관리자 대리 신청'}
                    </span>
                    <button type="button" className="btn btn-secondary !min-h-11 !py-1 text-ink" onClick={() => act.verifyPriority(a.id)} aria-label={`${userName(db, a.userId)} 우선 배정 확인 처리`}>
                      <ShieldCheck aria-hidden className="size-4" /> 확인 처리
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block sm:w-56">
              <span className="mb-1 block font-bold">시드값</span>
              <input className="field" inputMode="numeric" value={seed} onChange={(e) => setSeed(e.target.value)} />
            </label>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                const r = act.runDraw(group.id, Number(seed));
                setError(r.ok ? null : r.error);
              }}
            >
              <Dices aria-hidden className="size-5" /> 추첨 실행
            </button>
          </div>
          <p className="muted text-sm">같은 시드값과 같은 신청 목록이면 결과가 똑같이 재현돼요. 시드값과 실행 기록은 아래 감사 로그에 남아요. 비어 있는 값은 자동으로 제안돼요.</p>
        </>
      )}

      {group.state === 'pending' && <PendingResult group={group} db={db} />}
      <ErrorLine msg={error} />
    </article>
  );
}

function AuditLog({ db }: { db: Db }) {
  const [open, setOpen] = useState<string | null>(null);
  const [status, setStatus] = useState<'전체' | DrawLog['status'] & string>('전체');
  const logs = db.drawLogs.slice().sort((a, b) => b.executedAt.localeCompare(a.executedAt) || b.id.localeCompare(a.id)).filter((l) => status === '전체' || (l.status ?? '확정') === status);

  return (
    <section aria-labelledby="audit" className="space-y-3">
      <h2 id="audit" className="text-xl font-bold">감사 로그</h2>
      <p className="muted text-sm">추첨을 실행할 때마다 시각·실행자·대상 수·시드값이 남아요. 확정하지 않고 폐기한 추첨도 지워지지 않아요.</p>
      <label className="flex items-center gap-2 font-bold">
        상태
        <select className="field !w-auto" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          {['전체', '확정', '미확정', '폐기'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <div className="card overflow-x-auto !p-0" role="region" tabIndex={0} aria-label="추첨 감사 로그">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <caption className="sr-only">추첨 감사 로그</caption>
          <thead>
            <tr className="border-b-2 border-soil-200">
              {['실행 시각', '실행자', '시즌 · 텃밭', '대상 수', '구획', '시드값', '우선 대상', '방식', '상태', ''].map((h, i) => (
                <th key={i} scope="col" className="px-3 py-2">{h || <span className="sr-only">결과 보기</span>}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <Fragment key={l.id}>
                <tr className="border-b border-soil-200 align-top">
                  <td className="px-3 py-2">{formatDateTime(l.executedAt)}</td>
                  <td className="px-3 py-2">{userName(db, l.executedBy)}</td>
                  <td className="px-3 py-2">
                    {l.recruitmentSeason.replace('-', ' ')} · <strong>{nameOf(db, l.gardenId)}</strong>
                  </td>
                  <td className="px-3 py-2">{l.applicantCount}명</td>
                  <td className="px-3 py-2">{l.plotCount}개</td>
                  <td className="px-3 py-2 font-mono">{l.seed}</td>
                  <td className="px-3 py-2">{l.priorityGroupCount}명</td>
                  <td className="px-3 py-2">{l.note ?? '추첨'}</td>
                  <td className="px-3 py-2">
                    <Badge tone={LOG_STATUS_TONE[l.status ?? '확정']}>{l.status ?? '확정'}</Badge>
                    {l.discardReason && <span className="muted mt-1 block">사유: {l.discardReason}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <button type="button" className="btn btn-secondary !min-h-10 !px-3 !py-0" aria-expanded={open === l.id} onClick={() => setOpen(open === l.id ? null : l.id)}>
                      결과
                    </button>
                  </td>
                </tr>
                {open === l.id && (
                  <tr className="border-b border-soil-200 bg-leaf-50">
                    <td colSpan={10} className="px-3 py-3">
                      <Snapshot log={l} db={db} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center muted">기록이 없어요.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function Draw() {
  usePageTitle('추첨 실행 · 감사 로그');
  const db = useDb();
  const season = currentSeasonKey(db);
  const groups = drawGroups(db, season);
  const active = groups.filter((g) => g.state !== 'done');
  const done = groups.filter((g) => g.state === 'done');
  const pct = Math.round(db.settings.priorityQuotaRatio * 100);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">추첨 실행 · 감사 로그</h1>
        <p className="muted">
          {season.replace('-', ' ')} 시즌 · 마감된 텃밭을 골라 추첨하고, 결과를 확인한 뒤 확정·발표해요. 우선 배정 대상(다자녀·취약계층·노인)은 전체 구획의 일정 비율(기본 {pct}%, 정책에 따라 조정 가능)을 먼저 추첨하며, 당첨 확률을 높여 주는 가중치는 없어요.
        </p>
      </div>

      <Notice tone="info">
        <p className="text-sm">
          <strong>추첨 방식</strong> — ① 1지망을 먼저 추첨하고 떨어진 분은 2지망, 3지망 순서로 넘어가요. 이미 당첨된 분은 다음 지망에서 빠져요. ② 신청자가 구획 이하이면 추첨 없이 전원 배정해요(“무추첨 전원 배정”으로 기록). ③ 우선 몫 추첨에서 떨어진 분도 일반 추첨에 다시 참여해요. ④ 끝까지 배정받지 못한 분은 무작위로 대기번호를 받아요.
        </p>
      </Notice>

      <section aria-labelledby="targets" className="space-y-4">
        <h2 id="targets" className="text-xl font-bold">추첨 대상</h2>
        {active.length === 0 ? <div className="card muted">추첨할 텃밭이 없어요.</div> : active.map((g) => <GroupCard key={g.id} group={g} db={db} />)}
        {done.length > 0 && (
          <details className="card">
            <summary className="min-h-12 py-2 font-bold">추첨이 끝난 텃밭 {done.reduce((s, g) => s + g.gardenIds.length, 0)}곳</summary>
            <ul className="mt-2 space-y-1">
              {done.map((g) => (
                <li key={g.id}>{g.gardenIds.map((id) => nameOf(db, id)).join(' · ')}</li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <AuditLog db={db} />
    </div>
  );
}
