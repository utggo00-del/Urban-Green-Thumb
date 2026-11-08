import { ArrowLeft, ExternalLink, Globe, MapPin, Phone } from 'lucide-react';
import { Suspense, lazy, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge, Notice } from '../../components/Badge';
import { GardenCardSkeleton } from '../../components/GardenCard';
import { RealBadge } from '../../components/RealFarmCard';
import { REAL_FARM_SOURCE, getRealFarm, naverMapUrl, realFarmDong } from '../../data/realFarms';
import { usePageTitle } from '../../lib/usePageTitle';

const GardenMap = lazy(() => import('../../components/GardenMap'));

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="card space-y-3">
      <h2 id={id} className="text-xl font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

const NONE = <span className="muted">출처에 정보 없음</span>;

/** 실제 운영 텃밭 상세 — 앱의 신청·추첨 대상이 아니므로 농장 연락처와 출처만 안내한다. */
export default function RealFarmDetail() {
  const { id = '' } = useParams();
  const farm = getRealFarm(id);
  usePageTitle(farm ? farm.name : '텃밭을 찾을 수 없어요');

  if (!farm) {
    return (
      <div className="mx-auto max-w-xl space-y-4 text-center">
        <h1 className="text-2xl font-extrabold">텃밭을 찾을 수 없어요</h1>
        <Link to="/gardens?tab=real" className="btn btn-primary">
          실제 운영 텃밭 목록으로
        </Link>
      </div>
    );
  }

  const rows: [string, ReactNode][] = [
    ['운영', farm.operator === '정보 없음' ? NONE : `${farm.operator}${farm.operatorName ? ` · ${farm.operatorName}` : ''}`],
    ['한 구획', farm.plotPyeong ? `${farm.plotPyeong}평 (${farm.plotM2}㎡)` : NONE],
    ['분양가', farm.price ?? '농장에 문의'],
    ['신청 방법', farm.apply ?? NONE],
    ['시기', farm.period ?? NONE],
    ['편의시설', farm.amenities.length ? farm.amenities.join(' · ') : NONE],
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to="/gardens?tab=real" className="inline-flex min-h-12 items-center gap-1 font-bold">
        <ArrowLeft aria-hidden className="size-5" /> 실제 운영 텃밭 목록
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <RealBadge />
          <Badge>{farm.operator === '정보 없음' ? '운영 주체 정보 없음' : farm.operator}</Badge>
        </div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">{farm.name}</h1>
        <p className="muted">{farm.address}</p>
        <p>{farm.summary}</p>
      </header>

      <section aria-labelledby="contact" className="card space-y-3 border-amber-800 bg-amber-100/50">
        <h2 id="contact" className="text-xl font-bold">
          분양 문의
        </h2>
        <p>
          이 텃밭은 <strong>참도시농부 앱에서 신청·추첨하지 않아요.</strong> 농장에 직접 문의해 주세요.
        </p>
        {farm.note && <p className="font-bold text-clay-700">{farm.note}</p>}
        <div className="flex flex-wrap gap-2">
          {farm.phone && (
            <a href={`tel:${farm.phone}`} className="btn btn-primary">
              <Phone aria-hidden className="size-5" /> {farm.phone}
            </a>
          )}
          {farm.homepage && (
            <a href={farm.homepage} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
              <Globe aria-hidden className="size-5" /> 홈페이지·카페 <span className="sr-only">(새 창)</span>
            </a>
          )}
          <a href={naverMapUrl(farm)} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
            <MapPin aria-hidden className="size-5" /> 네이버 지도 <span className="sr-only">(새 창)</span>
          </a>
        </div>
        {!farm.phone && !farm.homepage && <p className="muted text-sm">출처에 연락처가 없어요. 네이버 지도에서 찾아보세요.</p>}
      </section>

      <Section id="info" title="분양 정보">
        <dl className="divide-y divide-soil-200">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[6rem_1fr] gap-3 py-2">
              <dt className="font-bold">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="loc" title="위치">
        <Suspense fallback={<GardenCardSkeleton />}>
          <GardenMap items={[]} farms={[farm]} zoomToSingle className="h-64 sm:h-80" label={`${farm.name} 위치 지도`} />
        </Suspense>
        <p>
          {farm.address} · <strong>{realFarmDong(farm)}</strong>
        </p>
      </Section>

      <Notice tone="info">
        <p className="font-bold">정보 출처</p>
        <p className="text-sm">
          {REAL_FARM_SOURCE.name} · {REAL_FARM_SOURCE.basis} · {REAL_FARM_SOURCE.checkedAt} 확인. 실제 내용은 바뀌었을 수 있으니 신청 전에 농장에 확인해 주세요.
        </p>
        <a href={farm.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm font-bold">
          출처 페이지 보기 <ExternalLink aria-hidden className="size-4" /> <span className="sr-only">(새 창)</span>
        </a>
      </Notice>
    </div>
  );
}
