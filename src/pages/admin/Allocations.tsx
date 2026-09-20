import { ArrowRight, FastForward } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Notice } from '../../components/Badge';
import * as act from '../../data/allocationActions';
import { currentSeasonKey, getUser } from '../../data/selectors';
import { useDb, useSession } from '../../data/useDb';
import { dDayLabel, daysBetween, formatDate } from '../../lib/date';
import { APPLICATION_STATUS, PLOT_STATUS } from '../../lib/labels';
import { usePageTitle } from '../../lib/usePageTitle';
import type { AdvanceSummary } from '../../lib/allocation';

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="card">
      <p className="muted text-sm font-bold">{label}</p>
      <p className="text-3xl font-extrabold text-leaf-800">{value}</p>
      {hint && <p className="muted text-sm">{hint}</p>}
    </div>
  );
}

export default function Allocations() {
  usePageTitle('분양·이용자 관리');
  const db = useDb();
  const { today } = useSession();
  const season = currentSeasonKey(db);
  const [gardenFilter, setGardenFilter] = useState('전체');
  const [summary, setSummary] = useState<AdvanceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const gname = (id: string | null) => db.gardens.find((g) => g.id === id)?.name ?? '-';
  const uname = (id: string | null) => (id ? getUser(db, id)?.name ?? id : '-');

  const offers = db.applications.filter((a) => a.recruitmentSeason === season && ['당첨', '수락', '포기'].includes(a.status) && a.assignedGardenId);
  const waiting = db.applications.filter((a) => a.recruitmentSeason === season && a.status === '대기');
  const pendingOffers = offers.filter((a) => a.status === '당첨');
  const unfilled = db.successions.filter((s) => s.toApplicationId === null);

  // 시뮬레이션 기본값: 가장 빠른 수락 기한 다음 날
  const nextDeadline = pendingOffers.map((a) => a.acceptDeadlineAt!).sort()[0];
  const suggestedDays = nextDeadline ? Math.max(1, daysBetween(today, nextDeadline) + 1) : 1;
  const [days, setDays] = useState('');
  const shown = days || String(suggestedDays);

  const users = useMemo(() => {
    const rows = db.plots.filter((p) => p.userId && (gardenFilter === '전체' || p.gardenId === gardenFilter));
    return rows.sort((a, b) => a.gardenId.localeCompare(b.gardenId) || a.number - b.number);
  }, [db.plots, gardenFilter]);
  const gardensWithUsers = [...new Set(db.plots.filter((p) => p.userId).map((p) => p.gardenId))];

  const waitByGarden = new Map<string, typeof waiting>();
  for (const a of waiting) for (const w of a.waitlist ?? []) waitByGarden.set(w.gardenId, [...(waitByGarden.get(w.gardenId) ?? []), a]);

  const simulate = () => {
    const r = act.advanceDays(Number(shown));
    if (!r.ok) {
      setError(r.error);
      setSummary(null);
      return;
    }
    setError(null);
    setSummary(r.value ?? null);
    setDays('');
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">분양·이용자 관리</h1>
        <p className="muted">당첨자의 수락 현황, 미수락 시 대기자 승계 내역, 이용자 목록을 확인해요. ({season.replace('-', ' ')} 시즌)</p>
      </div>

      <section aria-label="요약" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="수락 대기" value={pendingOffers.length} hint="기한 안에 수락해야 해요" />
        <Stat label="수락(이용중)" value={offers.filter((a) => a.status === '수락').length} />
        <Stat label="포기·기한 경과" value={offers.filter((a) => a.status === '포기').length} />
        <Stat label="대기자" value={waiting.length} hint="빈 구획이 나면 순서대로 승계" />
        <Stat label="재모집 필요" value={unfilled.length} hint="대기자가 없는 빈 구획" />
      </section>

      <section aria-labelledby="sim" className="card space-y-3 border-leaf-700">
        <h2 id="sim" className="text-xl font-bold">기한 경과 시뮬레이션 <span className="muted text-base font-normal">(시연용)</span></h2>
        <p>
          당첨 후 <strong>{db.settings.acceptDeadlineDays}일</strong> 안에 수락하지 않으면 자동 포기 처리되고 대기 1번에게 승계돼요. 시연 기준일을 앞으로 돌려 그 과정을 보여줘요. 모집 시작·마감 날짜도 함께 반영돼요.
        </p>
        <p className="text-sm">
          지금 기준일 <strong>{formatDate(today)}</strong>
          {nextDeadline && (
            <>
              {' '}
              · 가장 빠른 수락 기한 <strong>{formatDate(nextDeadline)}</strong> ({dDayLabel(nextDeadline, today)})
            </>
          )}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block sm:w-40">
            <span className="mb-1 block font-bold">며칠 뒤로</span>
            <input className="field" inputMode="numeric" value={shown} onChange={(e) => setDays(e.target.value)} />
          </label>
          <button type="button" className="btn btn-primary" onClick={simulate}>
            <FastForward aria-hidden className="size-5" /> 기한 경과 시뮬레이션
          </button>
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-100 p-3 font-bold text-red-700">{error}</p>}
        {summary && (
          <Notice tone="success">
            <p className="font-bold">기준일이 {formatDate(summary.today)}로 이동했어요</p>
            <ul className="list-disc pl-5 text-sm">
              <li>수락 기한 경과로 자동 포기 {summary.expired}건 → 대기자 승계 {summary.promoted}건{summary.unfilled > 0 ? `, 대기자가 없어 재모집 필요 ${summary.unfilled}건` : ''}</li>
              <li>모집 자동 시작 {summary.opened}건 · 자동 마감 {summary.closed}건</li>
            </ul>
          </Notice>
        )}
        <p className="muted text-sm">실서비스에서는 이 일을 매일 정해진 시각에 자동으로 처리해요. 시연 데이터 초기화로 기준일을 되돌릴 수 있어요.</p>
      </section>

      <section aria-labelledby="offers" className="space-y-3">
        <h2 id="offers" className="text-xl font-bold">당첨자 수락 현황</h2>
        {offers.length === 0 ? (
          <div className="card muted">
            아직 확정된 추첨이 없어요. <Link to="/admin/draw">추첨 실행</Link>에서 추첨을 확정하면 당첨자가 여기에 나타나요.
          </div>
        ) : (
          <div className="card overflow-x-auto !p-0" role="region" tabIndex={0} aria-label="당첨자 수락 현황">
            <table className="w-full min-w-[40rem] text-left">
              <caption className="sr-only">당첨자 수락 현황</caption>
              <thead>
                <tr className="border-b-2 border-soil-200 text-sm">
                  <th scope="col" className="px-3 py-2">신청자</th>
                  <th scope="col" className="px-3 py-2">텃밭 · 구획</th>
                  <th scope="col" className="px-3 py-2">상태</th>
                  <th scope="col" className="px-3 py-2">수락 기한</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((a) => {
                  const plot = db.plots.find((p) => p.gardenId === a.assignedGardenId && p.userId === a.userId);
                  const promoted = db.successions.some((s) => s.toApplicationId === a.id);
                  return (
                    <tr key={a.id} className="border-b border-soil-200">
                      <th scope="row" className="px-3 py-2">{uname(a.userId)}{a.priorityType !== '없음' && <span className="muted ml-1 text-sm font-normal">({a.priorityType})</span>}</th>
                      <td className="px-3 py-2">{gname(a.assignedGardenId)}{plot && ` · ${plot.number}번`}</td>
                      <td className="px-3 py-2">
                        <Badge tone={APPLICATION_STATUS[a.status].tone}>{APPLICATION_STATUS[a.status].label}</Badge>
                        {promoted && <span className="muted ml-2 text-sm">대기 승계</span>}
                      </td>
                      <td className="px-3 py-2">{a.status === '당첨' && a.acceptDeadlineAt ? `${formatDate(a.acceptDeadlineAt)} (${dDayLabel(a.acceptDeadlineAt, today)})` : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="succ" className="space-y-3">
        <h2 id="succ" className="text-xl font-bold">대기자 승계 내역</h2>
        {db.successions.length === 0 ? (
          <div className="card muted">아직 승계 내역이 없어요. 당첨자가 포기하거나 수락 기한이 지나면 대기자에게 구획이 넘어가요.</div>
        ) : (
          <ul className="space-y-2">
            {db.successions.slice().reverse().map((s) => (
              <li key={s.id} className="card flex flex-wrap items-center gap-x-3 gap-y-1 !py-3">
                <span className="muted text-sm">{formatDate(s.at)}</span>
                <strong>{gname(s.gardenId)}</strong>
                <Badge tone={s.reason === '기한 경과' ? 'warn' : 'neutral'}>{s.reason}</Badge>
                <span>{uname(s.fromUserId)}</span>
                <ArrowRight aria-hidden className="size-4" />
                {s.toUserId ? <strong>{uname(s.toUserId)}</strong> : <Badge tone="danger">대기자 없음 · 재모집 필요</Badge>}
                {s.note && s.toUserId && <span className="muted text-sm">({s.note})</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="wait" className="space-y-3">
        <h2 id="wait" className="text-xl font-bold">대기자 현황</h2>
        {waitByGarden.size === 0 ? (
          <div className="card muted">대기 중인 신청자가 없어요.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {[...waitByGarden.entries()].map(([gid, apps]) => (
              <div key={gid} className="card">
                <h3 className="font-extrabold">{gname(gid)} <span className="muted text-sm font-normal">대기 {apps.length}명</span></h3>
                <ol className="mt-1 text-sm">
                  {apps
                    .map((a) => ({ a, no: a.waitlist!.find((w) => w.gardenId === gid)!.no }))
                    .sort((x, y) => x.no - y.no)
                    .map(({ a, no }) => (
                      <li key={a.id}>
                        {no}번 {uname(a.userId)}
                      </li>
                    ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="users" className="space-y-3">
        <h2 id="users" className="text-xl font-bold">이용자 목록</h2>
        <label className="flex items-center gap-2 font-bold">
          텃밭
          <select className="field !w-auto" value={gardenFilter} onChange={(e) => setGardenFilter(e.target.value)}>
            <option>전체</option>
            {gardensWithUsers.map((id) => (
              <option key={id} value={id}>
                {gname(id)}
              </option>
            ))}
          </select>
        </label>
        <div className="card overflow-x-auto !p-0" role="region" tabIndex={0} aria-label="이용자 목록">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">이용자 목록</caption>
            <thead>
              <tr className="border-b-2 border-soil-200">
                {['이용자', '행정동', '연락처(가상)', '텃밭', '구획', '상태', '경고'].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((p) => {
                const u = getUser(db, p.userId!);
                return (
                  <tr key={p.id} className="border-b border-soil-200">
                    <th scope="row" className="px-3 py-2">{u?.name}</th>
                    <td className="px-3 py-2">{u?.dong}</td>
                    <td className="px-3 py-2">{u?.phone}</td>
                    <td className="px-3 py-2">{gname(p.gardenId)}</td>
                    <td className="px-3 py-2">{p.number}번</td>
                    <td className="px-3 py-2"><Badge tone={PLOT_STATUS[p.status].tone}>{PLOT_STATUS[p.status].label}</Badge></td>
                    <td className="px-3 py-2">{p.warningCount}회</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted text-sm">이용자 개인정보는 텃밭지원과 관리자만 볼 수 있어요. 심의위원 계정은 이 화면에 접근할 수 없어요.</p>
      </section>
    </div>
  );
}
