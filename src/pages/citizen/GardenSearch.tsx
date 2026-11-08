import { List, Map as MapIcon, Sparkles, SlidersHorizontal } from 'lucide-react';
import { Suspense, lazy, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Notice } from '../../components/Badge';
import { GardenCard, GardenCardSkeleton } from '../../components/GardenCard';
import { RealFarmCard } from '../../components/RealFarmCard';
import { REAL_FARMS, REAL_FARM_SOURCE, realFarmDong, type RealFarmOperator } from '../../data/realFarms';
import { useDb } from '../../data/useDb';
import {
  AREA_BUCKETS,
  EMPTY_FILTER,
  activeFilterCount,
  applyFilter,
  dongsOf,
  publishedViews,
  sortViews,
  type GardenFilter,
} from '../../lib/gardens';
import { usePageTitle } from '../../lib/usePageTitle';
import type { OrdinanceType, OwnerKind } from '../../types';

// Leaflet은 지도 보기를 처음 열 때만 내려받는다 (초기 로딩을 가볍게)
const GardenMap = lazy(() => import('../../components/GardenMap'));

const OWNERS: OwnerKind[] = ['공공', '민간', '개인'];
const ORDINANCE_TYPES: OrdinanceType[] = ['도시텃밭', '상자텃밭', '학습·생태체험텃밭'];
const RECRUIT_OPTIONS = ['전체', '모집중', '준비', '마감', '추첨완료', '모집 없음'] as const;
const RECRUIT_LABEL: Record<string, string> = { 전체: '전체', 모집중: '모집중', 준비: '모집 준비', 마감: '마감', 추첨완료: '추첨완료', '모집 없음': '이번 시즌 모집 없음' };
const REAL_OPERATORS: RealFarmOperator[] = ['공영', '민간', '정보 없음'];

type ViewMode = 'list' | 'map';
type Tab = 'app' | 'real';

function Select<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <label className="block">
      <span className="mb-1 block font-bold">{label}</span>
      <select className="field" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ViewToggle({ view, setView }: { view: ViewMode; setView: (v: ViewMode) => void }) {
  return (
    <div role="group" aria-label="보기 방식" className="inline-flex overflow-hidden rounded-xl border-2 border-leaf-700">
      {(
        [
          ['list', '목록 보기', List],
          ['map', '지도 보기', MapIcon],
        ] as const
      ).map(([v, label, Icon]) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          onClick={() => setView(v)}
          className={`inline-flex min-h-12 items-center gap-2 px-4 font-bold ${view === v ? 'bg-leaf-700 text-white' : 'bg-paper text-leaf-800 hover:bg-leaf-50'}`}
        >
          <Icon aria-hidden className="size-5" /> {label}
        </button>
      ))}
    </div>
  );
}

/** 실제 운영 텃밭 탭: 앱 신청 대상이 아니므로 운영 주체·행정동으로만 찾는다. */
function RealFarmResults() {
  const [operator, setOperator] = useState<RealFarmOperator | '전체'>('전체');
  const [dong, setDong] = useState('전체');
  const [view, setView] = useState<ViewMode>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dongs = useMemo(() => [...new Set(REAL_FARMS.map(realFarmDong))].sort((a, b) => a.localeCompare(b, 'ko')), []);
  const results = useMemo(
    () =>
      REAL_FARMS.filter((f) => (operator === '전체' || f.operator === operator) && (dong === '전체' || realFarmDong(f) === dong)).sort((a, b) =>
        a.name.localeCompare(b.name, 'ko'),
      ),
    [operator, dong],
  );
  const selected = results.find((f) => f.id === selectedId) ?? null;
  const filtered = operator !== '전체' || dong !== '전체';
  const clear = () => {
    setOperator('전체');
    setDong('전체');
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside aria-label="실제 운영 텃밭 조건 선택" className="space-y-3">
        <div className="card space-y-4">
          <Select
            label="운영 주체"
            value={operator}
            onChange={setOperator}
            options={[{ value: '전체', label: '전체' }, ...REAL_OPERATORS.map((o) => ({ value: o, label: o }))]}
          />
          <Select label="행정동" value={dong} onChange={setDong} options={[{ value: '전체', label: '전체' }, ...dongs.map((d) => ({ value: d, label: d }))]} />
          <button type="button" className="btn btn-secondary w-full" onClick={clear} disabled={!filtered}>
            조건 모두 지우기
          </button>
        </div>
        <p className="muted text-sm">
          출처:{' '}
          <a href={REAL_FARM_SOURCE.url} target="_blank" rel="noopener noreferrer" className="font-bold">
            {REAL_FARM_SOURCE.name}
          </a>{' '}
          ({REAL_FARM_SOURCE.basis}, {REAL_FARM_SOURCE.checkedAt} 확인)
        </p>
      </aside>

      <section aria-label="실제 운영 텃밭 결과" className="min-w-0 space-y-4">
        <Notice tone="info">
          <p className="font-bold">시흥시에서 실제로 운영 중인 텃밭이에요.</p>
          <p className="text-sm">앱에서 신청·추첨하지 않아요. 상세 화면의 전화·홈페이지로 농장에 직접 문의하세요.</p>
        </Notice>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p aria-live="polite" className="font-bold">
            실제 운영 텃밭 {REAL_FARMS.length}곳 중 <span className="text-leaf-700">{results.length}곳</span>
          </p>
          <ViewToggle view={view} setView={setView} />
        </div>
        {results.length === 0 ? (
          <div className="card space-y-3 text-center">
            <p className="text-lg font-bold">조건에 맞는 텃밭이 없어요.</p>
            <button type="button" className="btn btn-primary" onClick={clear}>
              조건 모두 지우기
            </button>
          </div>
        ) : view === 'list' ? (
          <ul className="grid gap-4 sm:grid-cols-2">
            {results.map((f) => (
              <li key={f.id}>
                <RealFarmCard farm={f} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-3">
            <Suspense fallback={<GardenCardSkeleton />}>
              <GardenMap items={[]} farms={results} selectedId={selectedId} onSelect={setSelectedId} className="h-[24rem] sm:h-[30rem]" label="실제 운영 텃밭 위치 지도" />
            </Suspense>
            {selected ? (
              <div aria-live="polite">
                <RealFarmCard farm={selected} headingLevel={2} />
              </div>
            ) : (
              <Notice tone="info">
                지도에서 <strong>실</strong> 마커를 눌러 보세요.
              </Notice>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export default function GardenSearch() {
  usePageTitle('텃밭 찾기');
  const db = useDb();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'real' ? 'real' : 'app';
  const setTab = (t: Tab) => setParams(t === 'real' ? { tab: 'real' } : {}, { replace: true });
  const [filter, setFilter] = useState<GardenFilter>(EMPTY_FILTER);
  const [view, setView] = useState<ViewMode>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showReal, setShowReal] = useState(true);

  const all = useMemo(() => publishedViews(db), [db]);
  const results = useMemo(() => sortViews(applyFilter(all, filter)), [all, filter]);
  const dongs = useMemo(() => dongsOf(all), [all]);
  const selected = results.find((v) => v.garden.id === selectedId) ?? null;
  const selectedFarm = showReal ? (REAL_FARMS.find((f) => f.id === selectedId) ?? null) : null;
  const activeCount = activeFilterCount(filter);
  const set = <K extends keyof GardenFilter>(k: K, v: GardenFilter[K]) => setFilter((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">텃밭 찾기</h1>
        <p className="muted">
          {tab === 'app' ? '도시농업위원회 심의를 거쳐 지정된 텃밭만 보여드려요. (조례 제11조)' : '시흥시에서 지금 운영 중인 공영·민간 텃밭을 모아 보여드려요.'}
        </p>
        <Link to="/helper" className="mt-2 inline-flex min-h-12 items-center gap-2 font-bold">
          <Sparkles aria-hidden className="size-5" /> 어떤 텃밭이 좋을지 모르겠다면 추천 도우미에게 물어보세요
        </Link>
      </div>

      <div role="tablist" aria-label="텃밭 종류" className="flex flex-wrap gap-2">
        {(
          [
            ['app', `앱에서 신청하는 텃밭 (${all.length})`],
            ['real', `시흥시 실제 운영 텃밭 (${REAL_FARMS.length})`],
          ] as const
        ).map(([t, label]) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`inline-flex min-h-12 items-center rounded-xl border-2 px-4 font-bold ${
              tab === t ? (t === 'real' ? 'border-amber-800 bg-amber-800 text-white' : 'border-leaf-700 bg-leaf-700 text-white') : 'border-soil-200 bg-paper hover:bg-leaf-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'real' ? (
        <RealFarmResults />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
          {/* 필터 */}
          <aside aria-label="텃밭 조건 선택" className="space-y-3">
            <button
              type="button"
              className="btn btn-secondary w-full lg:hidden"
              aria-expanded={filtersOpen}
              aria-controls="filters"
              onClick={() => setFiltersOpen((v) => !v)}
            >
              <SlidersHorizontal aria-hidden className="size-5" /> 조건 선택{activeCount > 0 ? ` (${activeCount}개 적용 중)` : ''}
            </button>
            <div id="filters" className={`card space-y-4 ${filtersOpen ? 'block' : 'hidden lg:block'}`}>
              <Select
                label="텃밭 유형"
                value={filter.owner}
                onChange={(v) => set('owner', v)}
                options={[{ value: '전체', label: '전체' }, ...OWNERS.map((o) => ({ value: o, label: `${o} 텃밭` }))]}
              />
              <Select
                label="조례상 유형"
                value={filter.ordinance}
                onChange={(v) => set('ordinance', v)}
                options={[{ value: '전체', label: '전체' }, ...ORDINANCE_TYPES.map((o) => ({ value: o, label: o }))]}
              />
              <Select label="행정동" value={filter.dong} onChange={(v) => set('dong', v)} options={[{ value: '전체', label: '전체' }, ...dongs.map((d) => ({ value: d, label: d }))]} />
              <Select label="구획 면적" value={filter.area} onChange={(v) => set('area', v)} options={AREA_BUCKETS.map((b) => ({ value: b.value, label: b.label }))} />
              <Select
                label="이용료"
                value={filter.fee}
                onChange={(v) => set('fee', v)}
                options={[
                  { value: 'all', label: '전체' },
                  { value: 'free', label: '무료' },
                  { value: 'paid', label: '유료' },
                ]}
              />
              <Select
                label="모집 상태"
                value={filter.recruit}
                onChange={(v) => set('recruit', v)}
                options={RECRUIT_OPTIONS.map((o) => ({ value: o, label: RECRUIT_LABEL[o] }))}
              />
              <button type="button" className="btn btn-secondary w-full" onClick={() => setFilter(EMPTY_FILTER)} disabled={activeCount === 0}>
                조건 모두 지우기
              </button>
            </div>
          </aside>

          {/* 결과 */}
          <section aria-label="검색 결과" className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p aria-live="polite" className="font-bold">
                지정 텃밭 {all.length}곳 중 <span className="text-leaf-700">{results.length}곳</span>
              </p>
              <ViewToggle view={view} setView={setView} />
            </div>

            {results.length === 0 ? (
              <div className="card space-y-3 text-center">
                <p className="text-lg font-bold">조건에 맞는 텃밭이 없어요.</p>
                <p className="muted">조건을 줄이거나 모두 지우고 다시 찾아보세요.</p>
                <button type="button" className="btn btn-primary" onClick={() => setFilter(EMPTY_FILTER)}>
                  조건 모두 지우기
                </button>
              </div>
            ) : view === 'list' ? (
              <ul className="grid gap-4 sm:grid-cols-2">
                {results.map((v) => (
                  <li key={v.garden.id}>
                    <GardenCard view={v} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="space-y-3">
                <Suspense fallback={<GardenCardSkeleton />}>
                  <GardenMap
                    items={results}
                    farms={showReal ? REAL_FARMS : []}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    className="h-[24rem] sm:h-[30rem]"
                    label="지정 텃밭 위치 지도"
                  />
                </Suspense>
                <label className="flex min-h-12 items-center gap-2 font-bold">
                  <input type="checkbox" className="size-5" checked={showReal} onChange={(e) => setShowReal(e.target.checked)} />
                  시흥시 실제 운영 텃밭({REAL_FARMS.length}곳)도 지도에 함께 보기
                </label>
                <p className="muted text-sm">
                  마커의 글자로 유형을 구분해요 — <strong>공</strong> 공공 · <strong>민</strong> 민간 · <strong>개</strong> 개인
                  {showReal && (
                    <>
                      {' '}
                      · 네모난 <strong>실</strong> 실제 운영 텃밭(앱 신청 대상 아님)
                    </>
                  )}
                  . 마커를 누르면 아래에 텃밭 정보가 나와요. 지도를 쓰기 어려우면 “목록 보기”를 이용하세요.
                </p>
                {selected ? (
                  <div aria-live="polite">
                    <GardenCard view={selected} headingLevel={2} />
                  </div>
                ) : selectedFarm ? (
                  <div aria-live="polite">
                    <RealFarmCard farm={selectedFarm} headingLevel={2} />
                  </div>
                ) : (
                  <Notice tone="info">지도에서 텃밭 마커를 눌러 보세요.</Notice>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
