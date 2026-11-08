import { ChevronRight, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { realFarmDong, type RealFarm } from '../data/realFarms';
import { Badge } from './Badge';

/** 실제 운영 텃밭 배지 — 지도 마커('실')와 같은 색 */
export function RealBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2.5 py-0.5 text-sm font-bold text-amber-800">
      <span aria-hidden className="grid size-4 place-items-center rounded-sm bg-amber-800 text-[10px] text-white">
        실
      </span>
      실제 운영 텃밭
    </span>
  );
}

/** 앱 밖에서 실제로 운영 중인 텃밭 카드 (앱에서 신청하지 않고 농장에 직접 문의) */
export function RealFarmCard({ farm: f, headingLevel = 3 }: { farm: RealFarm; headingLevel?: 2 | 3 }) {
  const H = `h${headingLevel}` as 'h2' | 'h3';
  return (
    <article className="card flex h-full flex-col gap-3" aria-label={f.name}>
      <div className="flex flex-wrap gap-2">
        <RealBadge />
        <Badge>{f.operator === '정보 없음' ? '운영 주체 정보 없음' : f.operator}</Badge>
      </div>

      <div>
        <H className="text-lg font-extrabold">{f.name}</H>
        <p className="muted flex items-center gap-1 text-sm">
          <MapPin aria-hidden className="size-4 shrink-0" /> {realFarmDong(f)}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg bg-amber-100/60 p-2">
          <dt className="muted text-sm">한 구획</dt>
          <dd className="font-extrabold">{f.plotPyeong ? `${f.plotPyeong}평` : '정보 없음'}</dd>
        </div>
        <div className="rounded-lg bg-amber-100/60 p-2">
          <dt className="muted text-sm">분양가</dt>
          <dd className="font-extrabold">{f.priceShort ?? '문의'}</dd>
        </div>
      </dl>

      <p className="text-sm">{f.summary}</p>
      {f.note && <p className="text-sm font-bold text-clay-700">{f.note}</p>}

      <Link to={`/farms/${f.id}`} className="btn btn-secondary mt-auto w-full" aria-label={`${f.name} 자세히 보기`}>
        자세히 보기 <ChevronRight aria-hidden className="size-5" />
      </Link>
    </article>
  );
}
