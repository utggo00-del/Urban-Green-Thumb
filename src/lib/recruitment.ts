// 모집 개설·상태 관리와 추첨 묶음 계산 (SPEC 3.2-4, 5.8). 순수 함수 — Db를 넘겨받아 조회하거나 고친다.
import { currentSeasonKey, getGarden, isPublished, seasonKeyOf } from '../data/selectors';
import type { Application, Db, Recruitment, SeasonKey, SeasonName } from '../types';
import { daysBetween } from './date';
import { fail, ok, type Res } from './workflow';

const isAdmin = (db: Db, id: string) => db.users.find((u) => u.id === id)?.role === '관리자';
const notAdmin = () => fail('텃밭지원과 관리자만 할 수 있는 작업입니다.');

export const vacantPlotCount = (db: Db, gardenId: string) => db.plots.filter((p) => p.gardenId === gardenId && p.status === '공실').length;

export interface RecruitmentInput {
  gardenId: string;
  year: number;
  season: SeasonName;
  applyStart: string;
  applyEnd: string;
  drawDate: string;
  plotsOffered: number;
  priorityQuotaRatio: number;
  acceptDeadlineDays: number;
}

export type RecruitmentPatch = Partial<Pick<RecruitmentInput, 'applyStart' | 'applyEnd' | 'drawDate' | 'plotsOffered' | 'priorityQuotaRatio'>>;

/** 지정되지 않은 텃밭에는 모집을 열 수 없다. 막히는 이유(안내 문구)를 돌려준다. */
export function openBlockReason(db: Db, gardenId: string): string | null {
  const g = getGarden(db, gardenId);
  if (!g) return '텃밭을 찾을 수 없습니다.';
  if (isPublished(g)) return null;
  return `「${g.name}」은(는) 아직 위원회 심의를 거쳐 지정되지 않아 모집을 열 수 없어요. (현재 상태: ${g.status}) 도시텃밭은 위원회 심의를 거쳐 지정되어야 공개·모집할 수 있어요. (조례 제11조)`;
}

function validate(db: Db, v: Pick<RecruitmentInput, 'gardenId' | 'applyStart' | 'applyEnd' | 'drawDate' | 'plotsOffered' | 'priorityQuotaRatio'>): string | null {
  if (!v.applyStart || !v.applyEnd || !v.drawDate) return '신청 시작일·마감일·추첨일을 모두 입력해 주세요.';
  if (v.applyEnd < v.applyStart) return '신청 마감일은 시작일보다 빠를 수 없어요.';
  if (v.drawDate <= v.applyEnd) return '추첨일은 신청 마감일 이후여야 해요.';
  if (!Number.isInteger(v.plotsOffered) || v.plotsOffered < 1) return '모집 구획 수는 1 이상의 정수로 입력해 주세요.';
  const vacant = vacantPlotCount(db, v.gardenId);
  if (v.plotsOffered > vacant) return `모집 구획은 빈 구획(${vacant}개)보다 많을 수 없어요.`;
  if (!(v.priorityQuotaRatio >= 0 && v.priorityQuotaRatio <= 1)) return '우선 배정 몫 비율은 0~100% 사이로 입력해 주세요.';
  return null;
}

/** 시즌 권장 신청 기간(설정값)을 벗어나면 안내 문구. 막지는 않는다. */
export function seasonWindowNote(db: Db, season: SeasonName, applyStart: string, applyEnd: string): string | null {
  const w = db.settings.seasonWindows[season];
  const sm = Number(applyStart.slice(5, 7));
  const em = Number(applyEnd.slice(5, 7));
  if (!sm || !em) return null;
  return sm < w.startMonth || em > w.endMonth ? `${season} 시즌의 기본 신청 기간은 ${w.startMonth}~${w.endMonth}월이에요. (설정값 · 다른 기간도 등록할 수 있어요)` : null;
}

export function openRecruitment(db: Db, input: RecruitmentInput, byId: string): Res<string> {
  if (!isAdmin(db, byId)) return notAdmin();
  const blocked = openBlockReason(db, input.gardenId);
  if (blocked) return fail(blocked);
  if (db.recruitments.some((r) => r.gardenId === input.gardenId && r.year === input.year && r.season === input.season)) {
    return fail('이 텃밭은 해당 시즌 모집이 이미 있어요.');
  }
  const bad = validate(db, input);
  if (bad) return fail(bad);
  const id = `rc_${input.year}${input.season === '봄' ? 's' : 'f'}_${input.gardenId}`;
  db.recruitments.push({ id, ...input, status: '준비' });
  return ok(id);
}

/** 모집 설정 변경 (모집 준비·모집 중일 때만). 우선 배정 몫 비율은 여기서 바꾼다. */
export function updateRecruitment(db: Db, id: string, patch: RecruitmentPatch, byId: string): Res {
  if (!isAdmin(db, byId)) return notAdmin();
  const r = db.recruitments.find((x) => x.id === id);
  if (!r) return fail('모집을 찾을 수 없습니다.');
  if (r.status !== '준비' && r.status !== '모집중') return fail('마감되었거나 추첨이 끝난 모집은 설정을 바꿀 수 없어요.');
  const next = { ...r, ...patch };
  const bad = validate(db, next);
  if (bad) return fail(bad);
  Object.assign(r, patch);
  return ok(undefined);
}

/** 준비 → 모집중 → 마감. 마감 이후는 추첨 확정으로만 추첨완료가 된다. */
export function setRecruitmentStatus(db: Db, id: string, next: '모집중' | '마감', byId: string): Res {
  if (!isAdmin(db, byId)) return notAdmin();
  const r = db.recruitments.find((x) => x.id === id);
  if (!r) return fail('모집을 찾을 수 없습니다.');
  if (next === '모집중') {
    if (r.status !== '준비') return fail('모집 준비 상태에서만 모집을 시작할 수 있어요.');
    const blocked = openBlockReason(db, r.gardenId);
    if (blocked) return fail(blocked);
    const bad = validate(db, r);
    if (bad) return fail(bad);
    r.status = '모집중';
    return ok(undefined);
  }
  if (r.status !== '모집중') return fail('모집 중인 텃밭만 마감할 수 있어요.');
  r.status = '마감';
  return ok(undefined);
}

/** 준비 중인 모집은 지울 수 있다. */
export function removeRecruitment(db: Db, id: string, byId: string): Res {
  if (!isAdmin(db, byId)) return notAdmin();
  const r = db.recruitments.find((x) => x.id === id);
  if (!r) return fail('모집을 찾을 수 없습니다.');
  if (r.status !== '준비') return fail('모집 준비 상태만 삭제할 수 있어요.');
  db.recruitments = db.recruitments.filter((x) => x.id !== id);
  return ok(undefined);
}

/** 새 모집을 만들 때 채워 줄 기본값 (설정값 기반) */
export function recruitmentDefaults(db: Db, season: SeasonName, year: number): Pick<RecruitmentInput, 'applyStart' | 'applyEnd' | 'drawDate' | 'priorityQuotaRatio' | 'acceptDeadlineDays'> {
  const w = db.settings.seasonWindows[season];
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    applyStart: `${year}-${p(w.startMonth)}-01`,
    applyEnd: `${year}-${p(w.endMonth)}-25`,
    drawDate: `${year}-${p(Math.min(12, w.endMonth + 1))}-05`,
    priorityQuotaRatio: db.settings.priorityQuotaRatio,
    acceptDeadlineDays: db.settings.acceptDeadlineDays,
  };
}

// ───────── 추첨 묶음 ─────────

export type GroupState = 'ready' | 'blocked' | 'pending' | 'done';

export interface DrawGroupInfo {
  id: string;
  season: SeasonKey;
  gardenIds: string[];
  recruitments: Recruitment[];
  /** 아직 결과가 정해지지 않은(접수·추첨대기) 신청 */
  applications: Application[];
  totalPlots: number;
  state: GroupState;
  /** 아직 마감되지 않아 추첨을 막고 있는 텃밭 */
  blockedBy: { gardenId: string; status: Recruitment['status'] }[];
}

export const isDrawable = (a: Application) => a.status === '접수' || a.status === '추첨대기';

/**
 * 추첨 묶음: 한 신청서에 함께 적힌 텃밭들은 지망 순위로 얽혀 있으므로 한 묶음으로 본다.
 * 묶음 안의 텃밭이 모두 마감되어야 함께 추첨할 수 있다. (일부만 먼저 추첨하면 아직 모집 중인 텃밭을 지망한 사람이 불공평해진다)
 */
export function drawGroups(db: Db, season: SeasonKey = currentSeasonKey(db)): DrawGroupInfo[] {
  const recs = db.recruitments.filter((r) => seasonKeyOf(r) === season);
  const byGarden = new Map(recs.map((r) => [r.gardenId, r]));
  const parent = new Map<string, string>(recs.map((r) => [r.gardenId, r.gardenId]));
  const find = (x: string): string => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x)!)), parent.get(x)!));
  const apps = db.applications.filter((a) => a.recruitmentSeason === season && isDrawable(a));
  for (const a of apps) {
    const ids = a.choices.filter((c) => byGarden.has(c));
    for (let i = 1; i < ids.length; i++) parent.set(find(ids[i]), find(ids[0]));
  }
  const comps = new Map<string, string[]>();
  for (const r of recs) {
    const root = find(r.gardenId);
    comps.set(root, [...(comps.get(root) ?? []), r.gardenId]);
  }

  return [...comps.values()]
    .map((gardenIds) => {
      gardenIds.sort();
      const recruitments = gardenIds.map((g) => byGarden.get(g)!);
      const id = `grp_${season}_${gardenIds.join('+')}`;
      const pending = db.drawLogs.some((l) => l.groupId === id && l.status === '미확정');
      const notClosed = recruitments.filter((r) => r.status !== '마감');
      let state: GroupState;
      if (recruitments.every((r) => r.status === '추첨완료')) state = 'done';
      else if (pending) state = 'pending';
      else if (notClosed.length === 0) state = 'ready';
      else state = 'blocked';
      return {
        id,
        season,
        gardenIds,
        recruitments,
        applications: apps.filter((a) => a.choices.some((c) => gardenIds.includes(c))),
        totalPlots: recruitments.reduce((s, r) => s + r.plotsOffered, 0),
        state,
        blockedBy: state === 'blocked' ? notClosed.map((r) => ({ gardenId: r.gardenId, status: r.status })) : [],
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** 신청 마감까지 남은 일수 (표시용) */
export const daysUntil = (db: Db, iso: string) => daysBetween(db.meta.today, iso);
