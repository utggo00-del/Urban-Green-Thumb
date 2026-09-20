import { CalendarClock } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Badge, Notice } from '../../components/Badge';
import { Steps } from '../../components/Steps';
import { cancelApplication } from '../../data/actions';
import { acceptOffer, declineOffer } from '../../data/allocationActions';
import { currentSeasonKey, getGarden } from '../../data/selectors';
import { useDb, useSession } from '../../data/useDb';
import { FLOW_STEPS, canCancel, flowIndex } from '../../lib/application';
import { dDayLabel, feeLabel, formatDate } from '../../lib/date';
import { APPLICATION_STATUS } from '../../lib/labels';
import { usePageTitle } from '../../lib/usePageTitle';
import type { Application, Db } from '../../types';

/** 신청완료 → 추첨대기 → 추첨 결과 → 수락 → 이용중 */
function FlowSteps({ db, app }: { db: Db; app: Application }) {
  const resultLabel = app.status === '당첨' ? '당첨' : app.status === '낙첨' ? '낙첨' : app.status === '대기' ? `대기 ${app.waitlistNo ?? ''}번` : '추첨 결과';
  const labels = FLOW_STEPS.map((l, i) => (i === 2 ? resultLabel : l));
  return <Steps labels={labels} current={flowIndex(db, app)} ariaLabel="진행 단계" />;
}

function ApplicationCard({ app, current }: { app: Application; current: boolean }) {
  const db = useDb();
  const { today } = useSession();
  const [confirming, setConfirming] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const st = APPLICATION_STATUS[app.status];
  const promoted = db.successions.some((x) => x.toApplicationId === app.id);
  const expired = app.status === '포기' && db.successions.some((x) => x.fromUserId === app.userId && x.reason === '기한 경과' && x.gardenId === app.assignedGardenId);
  const drawDate = db.recruitments
    .filter((r) => app.choices.includes(r.gardenId) && `${r.year}-${r.season}` === app.recruitmentSeason)
    .map((r) => r.drawDate)
    .sort()[0];
  const assigned = app.assignedGardenId ? getGarden(db, app.assignedGardenId) : null;

  return (
    <article className="card space-y-4" aria-label={`${app.recruitmentSeason.replace('-', ' ')} 시즌 신청`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-extrabold">{app.recruitmentSeason.replace('-', ' ')} 시즌</h2>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>

      <FlowSteps db={db} app={app} />

      {app.status === '당첨' && (
        <Notice tone="success">
          <p className="font-bold">{assigned?.name ?? '텃밭'}에 당첨되었어요!</p>
          {promoted && <p className="text-sm">대기 순번이 돌아와 당첨되었어요.</p>}
          {app.acceptDeadlineAt && (
            <p className="flex items-start gap-1.5">
              <CalendarClock aria-hidden className="mt-1.5 size-4 shrink-0" />
              <span>
                수락 기한 {formatDate(app.acceptDeadlineAt)} <strong>({dDayLabel(app.acceptDeadlineAt, today)})</strong>
              </span>
            </p>
          )}
          <p className="text-sm">기한 안에 수락하지 않으면 자동으로 포기 처리되고 대기자에게 넘어가요.</p>
          {assigned && assigned.type !== '공공' && assigned.fee > 0 && (
            <p className="mt-1 text-sm">이용료({feeLabel(assigned.fee)})는 제공자에게 직접 송금해요. 수락하면 “내 텃밭”에서 계좌를 안내해 드려요.</p>
          )}
        </Notice>
      )}
      {app.status === '당첨' && current && (
        <div className="space-y-2">
          {declining ? (
            <div role="group" aria-label="포기 확인" className="space-y-2 rounded-xl bg-amber-100 p-3 text-amber-800">
              <p className="font-bold">정말 포기할까요? 구획은 대기자에게 넘어가고, 되돌릴 수 없어요.</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => {
                    const r = declineOffer(app.id);
                    if (!r.ok) setError(r.error);
                  }}
                >
                  네, 포기할게요
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setDeclining(false)}>
                  아니요
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const r = acceptOffer(app.id);
                  if (r.ok) setNotice('수락했어요. 이제 이 텃밭을 이용하실 수 있어요.');
                  else setError(r.error);
                }}
              >
                수락하기
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setDeclining(true)}>
                포기하기
              </button>
            </div>
          )}
          {error && (
            <p role="alert" className="font-bold text-red-700">
              {error}
            </p>
          )}
        </div>
      )}
      {notice && (
        <p role="status" className="rounded-lg bg-leaf-100 p-3 font-bold text-leaf-800">
          {notice}
        </p>
      )}
      {app.status === '대기' && (
        <Notice tone="warn">
          <p className="font-bold">대기 중이에요</p>
          <ul className="list-disc pl-5">
            {(app.waitlist ?? []).map((w) => (
              <li key={w.gardenId}>
                {getGarden(db, w.gardenId)?.name} — <strong>대기 {w.no}번</strong>
              </li>
            ))}
          </ul>
          <p className="text-sm">앞선 당첨자가 포기하거나 수락 기한이 지나면 대기번호 순서대로 알려 드려요. 알림을 받으면 수락 기한 안에 수락해 주세요.</p>
        </Notice>
      )}
      {app.status === '낙첨' && <Notice tone="info">이번에는 배정되지 않았어요. 다음 시즌에 다시 신청하실 수 있어요.</Notice>}
      {app.status === '포기' && (
        <Notice tone="info">{expired ? '수락 기한이 지나 자동으로 포기 처리되었어요. 구획은 대기자에게 넘어갔어요.' : '당첨을 포기하셨어요. 구획은 대기자에게 넘어갔어요.'}</Notice>
      )}
      {app.status === '수락' && assigned && <Notice tone="success">{assigned.name}을(를) 이용 중이에요. “내 텃밭”에서 이용 안내를 확인하세요.</Notice>}
      {(app.status === '접수' || app.status === '추첨대기') && drawDate && (
        <p className="flex items-start gap-1.5">
          <CalendarClock aria-hidden className="mt-1 size-5 shrink-0" />
          <span>
            추첨 예정일 <strong>{formatDate(drawDate)}</strong> ({dDayLabel(drawDate, today)}) — 결과는 이 화면에 표시돼요.
          </span>
        </p>
      )}

      <div>
        <h3 className="mb-1 font-bold">희망 텃밭</h3>
        <ol className="space-y-1">
          {app.choices.map((gid, i) => {
            const g = getGarden(db, gid);
            return (
              <li key={gid} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-bold">{i + 1}지망</span>
                {g ? <Link to={`/gardens/${gid}`}>{g.name}</Link> : gid}
                {app.assignedGardenId === gid && <Badge tone="success">배정</Badge>}
              </li>
            );
          })}
        </ol>
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="muted">우선 배정</dt>
          <dd className="font-bold">
            {app.priorityType === '없음' ? '해당 없음' : `${app.priorityType} · ${app.priorityVerified ? '확인 완료' : '자기신고(확인 전)'}`}
          </dd>
        </div>
        <div>
          <dt className="muted">신청일</dt>
          <dd className="font-bold">{formatDate(app.consentAt)}</dd>
        </div>
        <div>
          <dt className="muted">신청 방식</dt>
          <dd className="font-bold">{app.appliedBy === '관리자대리' ? `관리자 대리 신청${app.proxyChannel ? ` (${app.proxyChannel} 접수)` : ''}` : '본인 신청'}</dd>
        </div>
      </dl>

      {current && canCancel(db, app) && (
        <div>
          {confirming ? (
            <div role="group" aria-label="신청 취소 확인" className="space-y-2 rounded-xl bg-amber-100 p-3 text-amber-800">
              <p className="font-bold">신청을 취소할까요? 취소한 뒤에는 다시 신청할 수 있어요.</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => {
                    const r = cancelApplication(app.id);
                    if (!r.ok) setError(r.error);
                  }}
                >
                  네, 취소할게요
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)}>
                  아니요
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={() => setConfirming(true)}>
              신청 취소하기
            </button>
          )}
          {error && (
            <p role="alert" className="mt-2 font-bold text-red-700">
              {error}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

export default function MyApplications() {
  usePageTitle('내 신청');
  const db = useDb();
  const { user } = useSession();
  const location = useLocation();
  const justApplied = (location.state as { justApplied?: string } | null)?.justApplied;

  const mine = db.applications.filter((a) => a.userId === user.id).sort((a, b) => b.recruitmentSeason.localeCompare(a.recruitmentSeason) || b.id.localeCompare(a.id));
  const seasonNow = currentSeasonKey(db);
  const currents = mine.filter((a) => a.recruitmentSeason === seasonNow && a.status !== '취소');
  const past = mine.filter((a) => !currents.includes(a));

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-extrabold sm:text-3xl">내 신청</h1>

      {justApplied && mine.some((a) => a.id === justApplied) && (
        <Notice tone="success">
          <p className="font-bold">신청이 접수되었어요.</p>
          <p className="text-sm">추첨 결과는 이 화면에서 확인하실 수 있어요.</p>
        </Notice>
      )}

      {mine.length === 0 ? (
        <div className="card space-y-3 text-center">
          <p className="text-lg font-bold">아직 신청한 내역이 없어요.</p>
          <p className="muted">마음에 드는 텃밭을 찾아 신청해 보세요.</p>
          <Link to="/gardens" className="btn btn-primary">
            텃밭 찾기
          </Link>
        </div>
      ) : (
        <>
          {currents.length === 0 && (
            <div className="card space-y-3">
              <p className="font-bold">이번 시즌 신청 내역이 없어요.</p>
              <Link to="/gardens" className="btn btn-primary w-full sm:w-auto">
                텃밭 찾기
              </Link>
            </div>
          )}
          {currents.map((a) => (
            <ApplicationCard key={a.id} app={a} current />
          ))}
          {past.length > 0 && (
            <section aria-labelledby="past" className="space-y-4">
              <h2 id="past" className="text-lg font-bold text-soil-700">
                지난 신청
              </h2>
              {past.map((a) => (
                <ApplicationCard key={a.id} app={a} current={false} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
