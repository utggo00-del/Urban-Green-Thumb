import { CalendarClock, ChevronRight, MapPin, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSession } from '../data/useDb';
import { dDayLabel, formatDate } from '../lib/date';
import type { GardenView } from '../lib/gardens';
import { RECRUITMENT_STATUS } from '../lib/labels';
import { Badge, KindBadge } from './Badge';

/** 텃밭 목록·지도 선택 시 보여주는 카드 (이름, 유형 배지, 구획 수, 잔여, 이용료, 모집 마감일) */
export function GardenCard({ view, headingLevel = 3 }: { view: GardenView; headingLevel?: 2 | 3 }) {
  const { today } = useSession();
  const { garden: g, recruitment: r, vacant, applicants } = view;
  const H = `h${headingLevel}` as 'h2' | 'h3';

  return (
    <article className="card flex h-full flex-col gap-3" aria-label={g.name}>
      <div className="flex flex-wrap gap-2">
        <KindBadge kind={g.type} />
        <Badge>{g.ordinanceType}</Badge>
      </div>

      <div>
        <H className="text-lg font-extrabold">{g.name}</H>
        <p className="muted flex items-center gap-1 text-sm">
          <MapPin aria-hidden className="size-4 shrink-0" /> {g.dong}
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-leaf-50 p-2">
          <dt className="muted text-sm">구획</dt>
          <dd className="font-extrabold">{g.plotCount}개</dd>
        </div>
        <div className="rounded-lg bg-leaf-50 p-2">
          <dt className="muted text-sm">잔여</dt>
          <dd className="font-extrabold">{vacant}개</dd>
        </div>
        <div className="rounded-lg bg-leaf-50 p-2">
          <dt className="muted text-sm">이용료</dt>
          <dd className="font-extrabold">{g.fee === 0 ? '무료' : `${(g.fee / 10000).toLocaleString('ko-KR')}만원`}</dd>
        </div>
      </dl>

      <div className="space-y-1">
        {r ? (
          <>
            <Badge tone={RECRUITMENT_STATUS[r.status].tone}>{RECRUITMENT_STATUS[r.status].label}</Badge>
            <p className="flex items-start gap-1.5 text-sm">
              <CalendarClock aria-hidden className="mt-1 size-4 shrink-0" />
              <span>
                {r.status === '준비' ? `신청 시작 ${formatDate(r.applyStart)}` : `마감 ${formatDate(r.applyEnd)}`}
                {r.status === '모집중' && <strong> ({dDayLabel(r.applyEnd, today)})</strong>}
              </span>
            </p>
            <p className="flex items-start gap-1.5 text-sm">
              <Users aria-hidden className="mt-1 size-4 shrink-0" />
              <span>
                {r.plotsOffered}구획 모집 · 지망 신청 {applicants}명
              </span>
            </p>
          </>
        ) : (
          <Badge>이번 시즌 모집 없음</Badge>
        )}
      </div>

      <Link to={`/gardens/${g.id}`} className="btn btn-secondary mt-auto w-full" aria-label={`${g.name} 자세히 보기`}>
        자세히 보기 <ChevronRight aria-hidden className="size-5" />
      </Link>
    </article>
  );
}

export function GardenCardSkeleton() {
  return <div aria-hidden className="card h-64 animate-pulse bg-soil-100" />;
}
