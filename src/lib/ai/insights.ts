// 관리자 인사이트 요약 (SPEC 9-3). 신청·배정 데이터에서 “다음 시즌 어느 동에 텃밭이 부족한가” 같은 문장을 만든다.
// 규칙 기반이라 같은 데이터면 같은 문장이 나오고, 모든 수치는 화면의 통계와 같은 출처(Db)에서 계산한다.
import { currentSeasonKey, getGarden, isPublished, nextMeeting } from '../../data/selectors';
import type { Db } from '../../types';
import { unverifiedPriority } from '../allocation';
import { dDayLabel } from '../date';
import { drawGroups } from '../recruitment';
import { percent, priorityStats, seasonStats } from '../stats';

export type InsightLevel = 'action' | 'notice' | 'good';

export interface Insight {
  id: string;
  level: InsightLevel;
  title: string;
  detail: string;
  /** 관련 화면 */
  link?: { to: string; label: string };
}

export interface InsightReport {
  season: string;
  /** 두세 문장으로 줄인 요약 */
  summary: string;
  insights: Insight[];
}

const LEVEL_ORDER: Record<InsightLevel, number> = { action: 0, notice: 1, good: 2 };

/** 신청자 거주 행정동별 수요와 지정 텃밭 구획(공급) 비교 */
export function demandByDong(db: Db, season: string) {
  const apps = db.applications.filter((a) => a.recruitmentSeason === season && a.status !== '취소');
  const demand = new Map<string, number>();
  for (const a of apps) {
    const dong = db.users.find((u) => u.id === a.userId)?.dong;
    if (dong && dong.endsWith('동')) demand.set(dong, (demand.get(dong) ?? 0) + 1);
  }
  const supply = new Map<string, { gardens: number; plots: number }>();
  for (const g of db.gardens.filter(isPublished)) {
    const s = supply.get(g.dong) ?? { gardens: 0, plots: 0 };
    s.gardens += 1;
    s.plots += g.plotCount;
    supply.set(g.dong, s);
  }
  const dongs = [...new Set([...demand.keys(), ...supply.keys()])];
  return dongs
    .map((dong) => {
      const d = demand.get(dong) ?? 0;
      const s = supply.get(dong) ?? { gardens: 0, plots: 0 };
      return { dong, applicants: d, gardens: s.gardens, plots: s.plots, perPlot: s.plots > 0 ? d / s.plots : null };
    })
    .sort((a, b) => a.dong.localeCompare(b.dong, 'ko'));
}

export function buildInsights(db: Db): InsightReport {
  const season = currentSeasonKey(db);
  const label = season.replace('-', ' ');
  const insights: Insight[] = [];
  const stats = seasonStats(db).find((s) => s.season === season);
  const gname = (id: string) => getGarden(db, id)?.name ?? id;

  // 1) 텃밭이 없는 동 / 수요 대비 공급이 적은 동
  const dongs = demandByDong(db, season);
  const totalApplicants = dongs.reduce((s, d) => s + d.applicants, 0);
  const totalPlots = dongs.reduce((s, d) => s + d.plots, 0);
  const avg = totalPlots > 0 ? totalApplicants / totalPlots : 0;
  const none = dongs.filter((d) => d.gardens === 0 && d.applicants >= 3).sort((a, b) => b.applicants - a.applicants);
  for (const d of none.slice(0, 2)) {
    insights.push({
      id: `no-garden-${d.dong}`, level: 'action',
      title: `${d.dong}에는 지정 텃밭이 없어요`,
      detail: `${label} 신청자 중 ${d.applicants}명이 ${d.dong}에 살지만 이 동에는 지정된 텃밭이 없어요. 다음 시즌 전에 ${d.dong} 안의 유휴지·공공 유휴 공간을 찾아 위원회 심의에 올리면 접근성이 좋아져요.`,
      link: { to: '/admin/review/new', label: '공공 텃밭 등록 입력' },
    });
  }
  const tight = dongs
    .filter((d) => d.gardens > 0 && d.applicants >= 3 && d.perPlot !== null && d.perPlot > Math.max(avg * 1.3, 0.3))
    .sort((a, b) => b.perPlot! - a.perPlot!)[0];
  if (tight) {
    insights.push({
      id: `tight-${tight.dong}`, level: 'notice',
      title: `${tight.dong}은 구획 대비 신청자가 많은 편이에요`,
      detail: `${tight.dong}에는 지정 텃밭 ${tight.gardens}곳(구획 ${tight.plots}개)이 있는데 거주 신청자가 ${tight.applicants}명으로, 구획 1개당 ${tight.perPlot!.toFixed(2)}명이에요. 전체 평균(${avg.toFixed(2)}명)보다 높아 확충 후보로 볼 수 있어요.`,
      link: { to: '/admin/stats', label: '행정동별 분포 보기' },
    });
  }

  // 2) 경쟁이 치열한 텃밭 (1지망 기준)
  const first = new Map<string, number>();
  for (const a of db.applications.filter((x) => x.recruitmentSeason === season && x.status !== '취소')) first.set(a.choices[0], (first.get(a.choices[0]) ?? 0) + 1);
  const hot = db.recruitments
    .filter((r) => `${r.year}-${r.season}` === season && r.plotsOffered > 0)
    .map((r) => ({ r, n: first.get(r.gardenId) ?? 0, rate: (first.get(r.gardenId) ?? 0) / r.plotsOffered }))
    .filter((x) => x.rate > 1.5)
    .sort((a, b) => b.rate - a.rate)[0];
  if (hot) {
    insights.push({
      id: `hot-${hot.r.gardenId}`, level: 'notice',
      title: `${gname(hot.r.gardenId)}의 경쟁이 가장 치열해요`,
      detail: `1지망 ${hot.n}명이 모집 구획 ${hot.r.plotsOffered}개를 두고 경쟁해 ${hot.rate.toFixed(1)} : 1이에요. 비슷한 동네의 다른 텃밭을 안내하거나 구획 확충을 검토해 볼 수 있어요.`,
      link: { to: '/admin/recruitments', label: '모집 관리' },
    });
  }

  // 3) 우선 배정 대상
  const pr = priorityStats(db, season);
  if (pr.priority > 0) {
    const pending = unverifiedPriority(db.applications.filter((a) => a.recruitmentSeason === season && (a.status === '접수' || a.status === '추첨대기')));
    insights.push({
      id: 'priority', level: pending.length > 0 ? 'action' : 'good',
      title: `우선 배정 대상은 신청의 ${percent(pr.share)}예요`,
      detail: `신청 ${pr.total}건 중 ${pr.priority}건(다자녀 ${pr.byKind[0].count} · 취약계층 ${pr.byKind[1].count} · 노인 ${pr.byKind[2].count})이에요.${pending.length > 0 ? ` 아직 증빙을 확인하지 않은 ${pending.length}건은 추첨 전에 확인해야 우선 몫에 들어가요.` : ' 모두 확인을 마쳤어요.'}`,
      link: pending.length > 0 ? { to: '/admin/draw', label: '추첨 화면에서 확인 처리' } : undefined,
    });
  }

  // 4) 추첨 이후 결과
  if (stats && stats.assigned + stats.waiting + stats.lost > 0) {
    const decided = stats.assigned + stats.waiting + stats.lost;
    insights.push({
      id: 'draw-result', level: 'notice',
      title: `추첨 결과: 배정률 ${percent(stats.assignedRate, 1)}`,
      detail: `추첨 결과가 난 ${decided}건 중 배정 ${stats.assigned}건, 대기 ${stats.waiting}건, 낙첨 ${stats.lost}건이에요. 수락한 분은 ${stats.accepted}건이고 포기·기한 경과는 ${stats.declined}건이에요.`,
      link: { to: '/admin/allocations', label: '분양·이용자 관리' },
    });
  }
  const pendingOffers = db.applications.filter((a) => a.status === '당첨').length;
  if (pendingOffers > 0) {
    insights.push({
      id: 'offers', level: 'notice',
      title: `수락을 기다리는 당첨자가 ${pendingOffers}명이에요`,
      detail: `수락 기한이 지나면 자동 포기되어 대기자에게 넘어가요. 기한이 임박한 분께 안내 알림을 보내면 포기를 줄일 수 있어요.`,
      link: { to: '/admin/notices', label: '공지·알림 관리' },
    });
  }
  const unfilled = db.successions.filter((x) => x.toApplicationId === null).length;
  if (unfilled > 0) {
    insights.push({
      id: 'unfilled', level: 'action',
      title: `대기자가 없어 비어 있는 구획이 ${unfilled}개예요`,
      detail: '포기·기한 경과·회수로 나온 구획 중 넘겨줄 대기자가 없는 곳이에요. 재모집을 열면 채울 수 있어요.',
      link: { to: '/admin/recruitments', label: '모집 관리' },
    });
  }

  // 5) 결과 대기 중인 추첨
  const groups = drawGroups(db, season);
  const ready = groups.filter((g) => g.state === 'ready');
  const pendingConfirm = groups.filter((g) => g.state === 'pending');
  if (ready.length + pendingConfirm.length > 0) {
    insights.push({
      id: 'draw-todo', level: 'action',
      title: '추첨 단계에서 처리할 일이 있어요',
      detail: `${ready.length > 0 ? `모집이 마감되어 추첨할 수 있는 묶음 ${ready.length}건` : ''}${ready.length > 0 && pendingConfirm.length > 0 ? ', ' : ''}${pendingConfirm.length > 0 ? `확정·발표를 기다리는 추첨 ${pendingConfirm.length}건` : ''}이 있어요.`,
      link: { to: '/admin/draw', label: '추첨 실행' },
    });
  }

  // 6) 심의 병목
  const waiting = db.gardens.filter((g) => g.status === '심의대기' || g.status === '검수중').length;
  const meeting = nextMeeting(db);
  if (waiting > 0) {
    insights.push({
      id: 'review-queue', level: 'notice',
      title: `심의를 기다리는 텃밭이 ${waiting}곳이에요`,
      detail: `${meeting ? `다음 위원회 회의는 ${dDayLabel(meeting.scheduledAt, db.meta.today)}예요. ` : '예정된 회의가 없어요. '}지정이 늦어지면 다음 모집 시즌에 텃밭을 열 수 없으니 회의 전에 안건으로 올려 주세요.`,
      link: { to: '/admin/committee', label: '위원회 관리' },
    });
  }

  // 7) 경고·회수
  const recall = db.plots.filter((p) => p.status === '회수대기').length;
  const danger = db.plots.filter((p) => p.status === '이용중' && p.warningCount === db.settings.warningLimit - 1).length;
  if (recall > 0 || danger > 0) {
    insights.push({
      id: 'warnings', level: recall > 0 ? 'action' : 'notice',
      title: recall > 0 ? `회수 확정을 기다리는 구획이 ${recall}개예요` : `경고 ${db.settings.warningLimit - 1}회인 이용자가 ${danger}명이에요`,
      detail: recall > 0 ? '경고가 기준에 도달했어요. 회수를 확정하면 대기자에게 승계돼요.' : '한 번 더 경고를 받으면 회수 대상이 돼요. 현장 점검과 안내를 먼저 해 볼 수 있어요.',
      link: { to: '/admin/warnings', label: '경고·회수 관리' },
    });
  }

  if (insights.length === 0) insights.push({ id: 'calm', level: 'good', title: '지금 눈에 띄는 문제는 없어요', detail: '처리할 일과 특이한 수치가 없어요.' });
  insights.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);

  const actions = insights.filter((i) => i.level === 'action');
  const top = insights.slice(0, 2).map((i) => i.title.replace(/[.。]$/, ''));
  const summary =
    `${label} 시즌 신청은 ${stats?.applicants ?? 0}건이고 모집 구획은 ${stats?.plotsOffered ?? 0}개예요. ` +
    (actions.length > 0 ? `바로 처리할 일이 ${actions.length}건 있어요. ` : '급하게 처리할 일은 없어요. ') +
    (top.length ? `주요 소식: ${top.join(' / ')}.` : '');
  return { season: label, summary, insights };
}
