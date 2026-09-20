import { useState } from 'react';
import { HBarChart, StackedBars, type StackRow } from '../../components/charts/Bars';
import { ChartCard, Meter } from '../../components/charts/ChartKit';
import { Donut } from '../../components/charts/Donut';
import { InsightsPanel } from '../../components/InsightsPanel';
import { OUTCOME_SERIES, OWNER_COLOR } from '../../components/charts/series';
import { currentSeasonKey } from '../../data/selectors';
import { useDb } from '../../data/useDb';
import { dongStats, percent, priorityStats, seasonStats, typeStats } from '../../lib/stats';
import { usePageTitle } from '../../lib/usePageTitle';
import type { SeasonKey } from '../../types';

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card">
      <p className="muted text-sm font-bold">{label}</p>
      <p className="mt-1 text-3xl font-extrabold text-leaf-800">{value}</p>
      <p className="muted mt-1 text-sm">{sub}</p>
    </div>
  );
}

export default function Stats() {
  usePageTitle('통계');
  const db = useDb();
  const seasons = seasonStats(db);
  const [season, setSeason] = useState<SeasonKey>(currentSeasonKey(db));
  const cur = seasons.find((s) => s.season === season) ?? seasons.at(-1)!;
  const prio = priorityStats(db, season);
  const types = typeStats(db);
  const dongs = dongStats(db);

  const seasonRows: StackRow[] = seasons.map((s) => ({
    key: s.season,
    label: s.season.replace('-', ' '),
    values: { assigned: s.assigned, waiting: s.waiting, lost: s.lost, pending: s.pending },
    note: `모집 구획 ${s.plotsOffered}개 · 경쟁률 ${s.competition === null ? '-' : `${s.competition.toFixed(1)} : 1`} · 배정률 ${percent(s.assignedRate, 1)}${s.assignedRate === null ? ' (추첨 전)' : ''}`,
  }));

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">통계</h1>
        <p className="muted">시즌별 배정 결과, 지정 텃밭의 유형·지역 분포, 우선 배정 대상 비율을 한눈에 봐요. (시연용 가상 데이터)</p>
      </div>

      <InsightsPanel />

      {/* 필터는 한 줄로 모아 위에 둔다 — 이 시즌 선택은 아래 요약 타일과 우선 배정 차트에 적용돼요 */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 font-bold">
          시즌
          <select className="field !w-auto" value={season} onChange={(e) => setSeason(e.target.value as SeasonKey)}>
            {seasons.map((s) => (
              <option key={s.season} value={s.season}>
                {s.season.replace('-', ' ')}
              </option>
            ))}
          </select>
        </label>
        <span className="muted text-sm">요약 타일과 “우선 배정 대상 비율”에 적용돼요.</span>
      </div>

      <section aria-label={`${season.replace('-', ' ')} 요약`} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="신청" value={`${cur.applicants}건`} sub={`모집 구획 ${cur.plotsOffered}개`} />
        <Tile label="경쟁률" value={cur.competition === null ? '-' : `${cur.competition.toFixed(1)} : 1`} sub="신청 ÷ 모집 구획" />
        <Tile label="배정률" value={percent(cur.assignedRate, 1)} sub={cur.assignedRate === null ? '추첨 결과가 나오면 계산돼요' : `배정 ${cur.assigned}건 (수락 ${cur.accepted} · 포기 ${cur.declined})`} />
        <Tile label="대리 신청" value={`${cur.proxyApplications}건`} sub="관리자가 대신 입력" />
      </section>

      <ChartCard
        title="시즌별 신청 대비 배정"
        subtitle="신청한 분이 추첨에서 어떻게 됐는지. 막대 길이는 신청 건수예요. 배정에는 구획을 받았다가 포기한 분도 포함해요."
        table={{
          caption: '시즌별 신청 결과',
          head: ['시즌', '신청', '배정', '대기', '낙첨', '추첨 전', '모집 구획', '경쟁률', '배정률'],
          rows: seasons.map((s) => [s.season.replace('-', ' '), s.applicants, s.assigned, s.waiting, s.lost, s.pending, s.plotsOffered, s.competition === null ? '-' : `${s.competition.toFixed(1)}:1`, percent(s.assignedRate, 1)]),
        }}
      >
        <StackedBars rows={seasonRows} series={OUTCOME_SERIES} ariaLabel="시즌별 신청 결과" />
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="유형별 지정 텃밭"
          subtitle="위원회 심의를 거쳐 지정된 텃밭만 세요."
          table={{
            caption: '유형별 지정 텃밭 수',
            head: ['구분', '텃밭 수', '구획 수'],
            rows: [
              ...types.owner.map((o) => [`${o.kind} 텃밭`, o.gardens, o.plots]),
              ...types.ordinance.map((o) => [`조례상 ${o.type}`, o.gardens, '-']),
            ],
          }}
        >
          <Donut
            ariaLabel="지정 텃밭의 공공·민간·개인 구성"
            centerLabel="지정 텃밭"
            segments={types.owner.map((o) => ({ key: o.kind, label: o.kind, value: o.gardens, color: OWNER_COLOR[o.kind] }))}
          />
          <div>
            <h3 className="mb-1 text-sm font-bold">조례상 유형</h3>
            <HBarChart
              ariaLabel="조례상 유형별 텃밭 수"
              max={Math.max(1, types.total)}
              rows={types.ordinance.map((o) => ({ key: o.type, label: o.type, value: o.gardens, valueText: `${o.gardens}곳`, tip: `${o.type} ${o.gardens}곳` }))}
            />
          </div>
        </ChartCard>

        <ChartCard
          title="우선 배정 대상 비율"
          subtitle={`${season.replace('-', ' ')} 신청 중 다자녀·취약계층·노인으로 자기신고한 분 (가중치 없이 우선 몫만 따로 추첨)`}
          table={{
            caption: '우선 배정 대상 현황',
            head: ['구분', '건수'],
            rows: [['전체 신청', prio.total], ['우선 배정 대상', prio.priority], ...prio.byKind.map((k) => [`　${k.kind}`, k.count]), ['관리자 확인 완료', prio.verified], ['확인 전', prio.unverified]],
          }}
        >
          {prio.total === 0 ? (
            <p className="muted">이 시즌에는 신청이 없어요.</p>
          ) : (
            <>
              <div>
                <p className="text-5xl font-extrabold leading-none text-leaf-800">{percent(prio.share)}</p>
                <p className="muted mt-1">
                  신청 {prio.total}건 중 우선 배정 대상 <strong>{prio.priority}건</strong>
                </p>
              </div>
              <Meter value={prio.priority} max={prio.total} label="우선 배정 대상 비율" text={`우선 배정 ${prio.priority} / 전체 ${prio.total}`} />
              <div>
                <h3 className="mb-1 text-sm font-bold">유형별</h3>
                <HBarChart
                  ariaLabel="우선 배정 유형별 건수"
                  max={Math.max(1, prio.priority)}
                  rows={prio.byKind.map((k) => ({ key: k.kind, label: k.kind, value: k.count, valueText: `${k.count}건`, tip: `${k.kind} ${k.count}건` }))}
                />
              </div>
              <Meter value={prio.verified} max={Math.max(1, prio.priority)} label="관리자 확인 완료 비율" text={`관리자 확인 완료 ${prio.verified} / ${prio.priority}건 (확인 전 ${prio.unverified}건은 일반 그룹으로 추첨)`} />
            </>
          )}
        </ChartCard>
      </div>

      <ChartCard
        title="행정동별 지정 텃밭 분포"
        subtitle="막대는 구획 수예요. 구획이 많은 동부터 보여요."
        table={{ caption: '행정동별 지정 텃밭', head: ['행정동', '텃밭 수', '구획 수'], rows: dongs.map((d) => [d.dong, d.gardens, d.plots]) }}
      >
        <HBarChart
          ariaLabel="행정동별 구획 수"
          rows={dongs.map((d) => ({ key: d.dong, label: d.dong, sub: `텃밭 ${d.gardens}곳`, value: d.plots, valueText: `${d.plots}개`, tip: `${d.dong}: 텃밭 ${d.gardens}곳 · 구획 ${d.plots}개` }))}
        />
      </ChartCard>
    </div>
  );
}
