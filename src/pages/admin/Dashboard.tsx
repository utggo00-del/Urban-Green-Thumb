import { BarChart3, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { currentSeasonKey, nextMeeting, recruitmentsOf } from '../../data/selectors';
import { useDb, useSession } from '../../data/useDb';
import { StackedBars } from '../../components/charts/Bars';
import { ChartCard } from '../../components/charts/ChartKit';
import { OUTCOME_SERIES } from '../../components/charts/series';
import { unverifiedPriority } from '../../lib/allocation';
import { drawGroups } from '../../lib/recruitment';
import { seasonStats } from '../../lib/stats';
import { dDayLabel, formatDateTime } from '../../lib/date';
import { usePageTitle } from '../../lib/usePageTitle';

function Stat({ label, value, hint, to }: { label: string; value: ReactNode; hint?: string; to: string }) {
  return (
    <Link to={to} className="card block no-underline transition hover:border-leaf-700 hover:bg-leaf-50">
      <p className="muted text-sm font-bold">{label}</p>
      <p className="mt-1 text-3xl font-extrabold text-leaf-800">{value}</p>
      {hint && <p className="muted mt-1 text-sm">{hint}</p>}
    </Link>
  );
}

/** 오늘 처리할 일과 핵심 수치, 이번 시즌 신청 현황. 자세한 통계는 통계 화면에서 본다. */
export default function AdminDashboard() {
  usePageTitle('관리자 대시보드');
  const db = useDb();
  const { today } = useSession();

  const season = currentSeasonKey(db);
  const seasonRecs = recruitmentsOf(db, season);
  const meeting = nextMeeting(db);

  const inspecting = db.gardens.filter((g) => g.status === '검수중').length;
  const waiting = db.gardens.filter((g) => g.status === '심의대기' || g.status === '심의중').length;
  const openCount = seasonRecs.filter((r) => r.status === '모집중').length;
  const closed = seasonRecs.filter((r) => r.status === '마감');
  const applicants = new Set(db.applications.filter((a) => a.recruitmentSeason === season && a.status !== '취소').map((a) => a.userId)).size;
  const groups = drawGroups(db, season);
  const readyGroups = groups.filter((g) => g.state === 'ready').length;
  const pendingDraws = groups.filter((g) => g.state === 'pending').length;
  const pendingOffers = db.applications.filter((a) => a.status === '당첨').length;
  const preparing = seasonRecs.filter((r) => r.status === '준비').length;
  const unfilled = db.successions.filter((x) => x.toApplicationId === null).length;
  const unverified = unverifiedPriority(db.applications.filter((a) => a.recruitmentSeason === season && (a.status === '접수' || a.status === '추첨대기'))).length;
  const stat = seasonStats(db).find((x) => x.season === season);
  const recallWaiting = db.plots.filter((p) => p.status === '회수대기').length;
  const onTwoWarnings = db.plots.filter((p) => p.warningCount === db.settings.warningLimit - 1).length;

  const todo = [
    { n: inspecting, text: `실무 검수 대기 텃밭 ${inspecting}건`, to: '/admin/review' },
    { n: waiting, text: `심의 대기 텃밭 ${waiting}건 — 위원회 안건 상정`, to: '/admin/committee' },
    { n: readyGroups, text: `모집이 마감되어 추첨할 수 있는 묶음 ${readyGroups}건 — 추첨 실행`, to: '/admin/draw' },
    { n: pendingDraws, text: `추첨 결과 확정·발표 대기 ${pendingDraws}건`, to: '/admin/draw' },
    { n: preparing, text: `모집 준비 상태 텃밭 ${preparing}곳 — 모집 시작`, to: '/admin/recruitments' },
    { n: unverified, text: `우선 배정 자기신고 확인 대기 ${unverified}건`, to: '/admin/draw' },
    { n: pendingOffers, text: `당첨 후 수락 대기 ${pendingOffers}명`, to: '/admin/allocations' },
    { n: recallWaiting, text: `회수 확정 대기 ${recallWaiting}건`, to: '/admin/warnings' },
    { n: unfilled, text: `대기자가 없어 재모집이 필요한 구획 ${unfilled}개`, to: '/admin/recruitments' },
    { n: onTwoWarnings, text: `경고 ${db.settings.warningLimit - 1}회(회수 직전) 이용자 ${onTwoWarnings}명 — 점검 필요`, to: '/admin/warnings' },
  ].filter((t) => t.n > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">대시보드</h1>
        <p className="muted">{season.replace('-', ' ')} 시즌 기준 요약입니다.</p>
      </div>

      <section aria-labelledby="todo" className="card space-y-2">
        <h2 id="todo" className="text-lg font-bold">
          오늘 처리할 일
        </h2>
        {todo.length === 0 ? (
          <p className="muted">처리할 일이 없어요.</p>
        ) : (
          <ul className="divide-y divide-soil-200">
            {todo.map((t) => (
              <li key={t.text}>
                <Link to={t.to} className="flex min-h-12 items-center justify-between gap-2 py-2 font-bold no-underline">
                  {t.text}
                  <ChevronRight aria-hidden className="size-5 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="주요 수치" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="등록 텃밭" value={`${db.gardens.length}곳`} hint={`지정 ${db.gardens.filter((g) => g.status === '지정').length}곳`} to="/admin/review" />
        <Stat label="실무 검수 대기" value={`${inspecting}건`} to="/admin/review" />
        <Stat label="심의 대기 안건" value={`${waiting}건`} to="/admin/committee" />
        <Stat
          label="다음 위원회 회의"
          value={meeting ? dDayLabel(meeting.scheduledAt, today) : '-'}
          hint={meeting ? formatDateTime(meeting.scheduledAt) : '예정된 회의 없음'}
          to="/admin/committee"
        />
        <Stat label="진행 중 모집" value={`${openCount}곳`} to="/admin/recruitments" />
        <Stat label="신청자" value={`${applicants}명`} to="/admin/allocations" />
        <Stat label="추첨 예정" value={`${closed.length}곳`} hint={`마감 완료 · 확정 대기 ${pendingDraws}건`} to="/admin/draw" />
        <Stat label="회수 대기" value={`${recallWaiting}건`} hint={`경고 ${db.settings.warningLimit - 1}회 ${onTwoWarnings}명`} to="/admin/warnings" />
      </section>

      {stat && (
        <ChartCard title={`${season.replace('-', ' ')} 신청 현황`} subtitle="신청한 분의 추첨 결과 구성이에요.">
          <StackedBars
            ariaLabel="이번 시즌 신청 결과"
            series={OUTCOME_SERIES}
            rows={[{ key: season, label: season.replace('-', ' '), values: { assigned: stat.assigned, waiting: stat.waiting, lost: stat.lost, pending: stat.pending }, note: `모집 구획 ${stat.plotsOffered}개 · 경쟁률 ${stat.competition === null ? '-' : `${stat.competition.toFixed(1)} : 1`}` }]}
          />
          <Link to="/admin/stats" className="btn btn-secondary w-full sm:w-auto">
            <BarChart3 aria-hidden className="size-5" /> 통계 자세히 보기
          </Link>
        </ChartCard>
      )}
    </div>
  );
}
