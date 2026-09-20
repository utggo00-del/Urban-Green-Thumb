import { CalendarDays, ChevronRight, Megaphone, Sparkles, Sprout } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Notice as Callout } from '../../components/Badge';
import {
  currentSeasonKey,
  getGarden,
  gardensOwnedBy,
  myApplication,
  nextMeeting,
  noticesFor,
  openRecruitments,
  recruitmentsOf,
} from '../../data/selectors';
import { useDb, useSession } from '../../data/useDb';
import { dDayLabel, formatDate, formatDateTime } from '../../lib/date';
import { APPLICATION_STATUS, GARDEN_STATUS } from '../../lib/labels';
import { usedPlots, warningLevel } from '../../lib/warnings';
import { usePageTitle } from '../../lib/usePageTitle';
import type { SeasonName } from '../../types';

export default function CitizenHome() {
  usePageTitle('홈');
  const db = useDb();
  const { user, role, today } = useSession();

  const season = currentSeasonKey(db);
  const open = openRecruitments(db);
  const seasonRecruits = recruitmentsOf(db, season);
  const app = myApplication(db, user.id, season);
  const nearestEnd = open.map((r) => r.applyEnd).sort()[0];
  const myPlots = usedPlots(db, user.id);
  const warnedPlots = myPlots.filter((p) => p.warningCount > 0);
  const notices = noticesFor(db, role === 'provider' ? '제공자' : '이용자').slice(0, 3);
  const meeting = nextMeeting(db);
  const owned = gardensOwnedBy(db, user.id);

  return (
    <div className="space-y-6">
      <section aria-labelledby="hello">
        <h1 id="hello" className="text-2xl font-extrabold sm:text-3xl">
          안녕하세요, {user.name}님
        </h1>
        <p className="muted mt-1">
          {role === 'provider' ? '내 땅을 도시텃밭으로 등록하고 진행 상황을 확인해 보세요.' : '가까운 텃밭을 찾아 분양을 신청해 보세요.'}
        </p>
      </section>

      {!user.isSiheungResident && (
        <Callout tone="warn">
          <p className="font-bold">시흥시민만 신청할 수 있습니다.</p>
          <p className="text-sm">현재 계정은 {user.dong} 거주로 등록되어 있어 분양 신청 버튼이 비활성화됩니다. (시연용 계정)</p>
        </Callout>
      )}

      {warnedPlots.map((p) => {
        const level = warningLevel(p.warningCount, db.settings.warningLimit);
        return (
          <Callout key={p.id} tone={level === 'notice' ? 'warn' : 'danger'}>
            <p className="font-bold">
              {getGarden(db, p.gardenId)?.name} {p.number}번 구획: 미경작 경고 {p.warningCount}회
              {level === 'recall' ? ' — 회수 대상이에요' : level === 'danger' ? ' — 한 번 더 받으면 회수돼요' : ''}
            </p>
            <p className="text-sm">
              <Link to="/my/plots">내 텃밭에서 사유 확인하기</Link>
            </p>
          </Callout>
        );
      })}

      {role === 'provider' && (
        <section aria-labelledby="my-regs" className="card space-y-3">
          <h2 id="my-regs" className="text-xl font-bold">
            내가 등록한 텃밭
          </h2>
          <ul className="divide-y divide-soil-200">
            {owned.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-bold">{g.name}</span>
                <Badge tone={GARDEN_STATUS[g.status].tone}>{GARDEN_STATUS[g.status].label}</Badge>
              </li>
            ))}
          </ul>
          {meeting && (
            <p className="rounded-lg bg-sky-100 p-3 text-sm text-sky-800">
              다음 위원회 회의: <strong>{formatDateTime(meeting.scheduledAt)}</strong> ({dDayLabel(meeting.scheduledAt, today)}) — 정례회의 일정에 따라 심의까지 시일이 걸릴 수 있습니다.
            </p>
          )}
          <Link to="/register" className="btn btn-primary w-full sm:w-auto">
            텃밭 등록 신청하기 <ChevronRight aria-hidden className="size-5" />
          </Link>
        </section>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section aria-labelledby="open-count" className="card flex flex-col justify-between gap-4 bg-leaf-50">
          <div>
            <h2 id="open-count" className="text-lg font-bold text-leaf-800">
              지금 모집 중인 텃밭
            </h2>
            <p className="mt-1 text-4xl font-extrabold text-leaf-800">
              {open.length}
              <span className="ml-1 text-xl font-bold">곳</span>
            </p>
            {nearestEnd && (
              <p className="muted mt-1">
                가장 빠른 마감 {formatDate(nearestEnd)} ({dDayLabel(nearestEnd, today)})
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Link to="/gardens" className="btn btn-primary w-full">
              <Sprout aria-hidden className="size-5" /> 텃밭 찾기
            </Link>
            <Link to="/helper" className="btn btn-secondary w-full">
              <Sparkles aria-hidden className="size-5" /> 나에게 맞는 텃밭 추천받기
            </Link>
          </div>
        </section>

        <section aria-labelledby="my-app" className="card space-y-3">
          <h2 id="my-app" className="text-lg font-bold">
            내 신청 현황 <span className="muted text-base font-normal">({season.replace('-', ' ')})</span>
          </h2>
          {app ? (
            <>
              <Badge tone={APPLICATION_STATUS[app.status].tone}>{APPLICATION_STATUS[app.status].label}</Badge>
              <ol className="space-y-1">
                {app.choices.map((gid, i) => (
                  <li key={gid}>
                    <span className="font-bold">{i + 1}지망</span> {getGarden(db, gid)?.name}
                  </li>
                ))}
              </ol>
              <Link to="/my/applications" className="btn btn-secondary w-full">
                내 신청 자세히 보기
              </Link>
            </>
          ) : (
            <>
              <p className="muted">이번 시즌에 신청한 내역이 없어요.</p>
              <Link to="/gardens" className="btn btn-secondary w-full">
                텃밭 고르러 가기
              </Link>
            </>
          )}
          {myPlots.length > 0 && (
            <p className="rounded-lg bg-leaf-100 p-3 text-sm text-leaf-800">
              이용 중인 텃밭 {myPlots.length}곳 · <Link to="/my/plots">내 텃밭 보기</Link>
            </p>
          )}
        </section>
      </div>

      <section aria-labelledby="schedule" className="card space-y-3">
        <h2 id="schedule" className="flex items-center gap-2 text-lg font-bold">
          <CalendarDays aria-hidden className="size-5" /> 모집 일정 (연 2회)
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {(['봄', '가을'] as SeasonName[]).map((s) => {
            const w = db.settings.seasonWindows[s];
            const recs = db.recruitments.filter((r) => r.season === s && r.year === Number(today.slice(0, 4)));
            const isNow = season.endsWith(s);
            const end = recs.map((r) => r.applyEnd).sort().at(-1);
            return (
              <li key={s} className={`rounded-xl border p-4 ${isNow ? 'border-leaf-700 bg-leaf-50' : 'border-soil-200'}`}>
                <p className="flex items-center gap-2 font-bold">
                  {s} 시즌 {isNow && <Badge tone="success">이번 시즌</Badge>}
                </p>
                <p className="muted text-sm">
                  신청 기간 {w.startMonth}~{w.endMonth}월
                </p>
                {isNow && end && <p className="text-sm">올해 신청 마감 {formatDate(end)}</p>}
                {!isNow && recs.length > 0 && <p className="text-sm">올해 {s} 시즌은 추첨까지 마쳤어요.</p>}
              </li>
            );
          })}
        </ul>
        <p className="muted text-sm">모집 시즌은 위원회 심의를 거쳐 지정된 텃밭만 열 수 있어요. 아직 공개되지 않은 텃밭은 목록에 보이지 않습니다.</p>
        {seasonRecruits.length === 0 && <p className="muted text-sm">이번 시즌 모집 정보가 아직 없어요.</p>}
      </section>

      <section aria-labelledby="notices" className="card space-y-3">
        <h2 id="notices" className="flex items-center gap-2 text-lg font-bold">
          <Megaphone aria-hidden className="size-5" /> 공지
        </h2>
        {notices.length === 0 ? (
          <p className="muted">등록된 공지가 없어요.</p>
        ) : (
          <ul className="divide-y divide-soil-200">
            {notices.map((n) => (
              <li key={n.id} className="py-3">
                <p className="flex flex-wrap items-center gap-2 font-bold">
                  {n.pinned && <Badge tone="info">중요</Badge>}
                  {n.title}
                </p>
                <p className="muted text-sm">{formatDate(n.createdAt)}</p>
                <p className="mt-1">{n.body}</p>
              </li>
            ))}
          </ul>
        )}
        <Link to="/notices" className="font-bold">
          공지 전체 보기
        </Link>
      </section>
    </div>
  );
}
