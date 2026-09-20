import { describe, expect, it } from 'vitest';
import { buildSeed } from '../data/seed';
import { confirmDraw, runDraw } from './allocation';
import { drawGroups } from './recruitment';
import { dongStats, percent, priorityStats, ratio, seasonStats, typeStats } from './stats';

const db = buildSeed();

describe('비율 도우미', () => {
  it('0으로 나누면 null, 표기는 퍼센트', () => {
    expect(ratio(1, 0)).toBeNull();
    expect(ratio(1, 4)).toBe(0.25);
    expect(percent(null)).toBe('-');
    expect(percent(0.789, 1)).toBe('78.9%');
    expect(percent(0.2)).toBe('20%');
  });
});

describe('시즌별 신청 대비 배정률', () => {
  const stats = seasonStats(db);
  const spring = stats.find((s) => s.season === '2026-봄')!;
  const fall = stats.find((s) => s.season === '2026-가을')!;

  it('시즌이 오름차순으로 나온다', () => {
    expect(stats.map((s) => s.season)).toEqual(['2026-가을', '2026-봄'].sort());
  });

  it('봄(추첨 완료): 신청 38건(수락 30 + 낙첨 8) → 배정률 78.9%', () => {
    expect(spring).toMatchObject({ applicants: 38, assigned: 30, accepted: 30, lost: 8, waiting: 0, pending: 0, plotsOffered: 30 });
    expect(spring.assignedRate).toBeCloseTo(30 / 38, 5);
    expect(spring.competition).toBeCloseTo(38 / 30, 5);
  });

  it('가을(추첨 전): 신청 60건은 모두 추첨 전이라 배정률은 아직 없다', () => {
    expect(fall.applicants).toBe(60);
    expect(fall.pending).toBe(60);
    expect(fall.assignedRate).toBeNull();
    expect(fall.proxyApplications).toBe(3); // 시드의 고령 신청자 대리 신청
    expect(fall.plotsOffered).toBe(12 + 10 + 6 + 8 + 6 + 8 + 10 + 6 + 3 + 5 + 4);
  });

  it('추첨 확정 후: 신청 = 배정 + 대기 + 낙첨 + 추첨 전, 배정률은 결과가 난 신청 기준', () => {
    const d = structuredClone(db);
    for (const g of drawGroups(d).filter((x) => x.state === 'ready')) {
      runDraw(d, g.id, 20260922, 'u_admin1');
      confirmDraw(d, g.id, 'u_admin1');
    }
    const s = seasonStats(d).find((x) => x.season === '2026-가을')!;
    expect(s.applicants).toBe(s.assigned + s.waiting + s.lost + s.pending);
    expect(s.assigned).toBe(14);
    expect(s.pending).toBe(31);
    expect(s.assignedRate).toBeCloseTo(14 / (14 + s.waiting + s.lost), 5);
  });

  it('취소한 신청은 세지 않고, 포기(받았다가 놓음)는 배정으로 센다', () => {
    const d = structuredClone(db);
    const a = d.applications.find((x) => x.recruitmentSeason === '2026-가을')!;
    a.status = '취소';
    expect(seasonStats(d).find((x) => x.season === '2026-가을')!.applicants).toBe(59);
    const w = d.applications.find((x) => x.recruitmentSeason === '2026-봄')!;
    w.status = '포기';
    const sp = seasonStats(d).find((x) => x.season === '2026-봄')!;
    expect(sp.declined).toBe(1);
    expect(sp.assigned).toBe(30); // 수락 29 + 포기 1
    expect(sp.accepted).toBe(29);
  });
});

describe('유형별·행정동별 분포 (지정된 텃밭 기준)', () => {
  it('공공 5 · 민간 4 · 개인 3, 조례상 유형별 수', () => {
    const t = typeStats(db);
    expect(t.total).toBe(12);
    expect(t.owner.map((o) => [o.kind, o.gardens])).toEqual([['공공', 5], ['민간', 4], ['개인', 3]]);
    expect(t.owner.reduce((s, o) => s + o.plots, 0)).toBe(db.gardens.filter((g) => g.status === '지정').reduce((s, g) => s + g.plotCount, 0));
    expect(t.ordinance.map((o) => o.gardens).reduce((a, b) => a + b, 0)).toBe(12);
    expect(t.ordinance.find((o) => o.type === '상자텃밭')?.gardens).toBe(2);
  });

  it('심의를 거치지 않은 텃밭은 통계에서 빠진다', () => {
    expect(typeStats(db).total).toBe(12); // 16곳 등록 중 지정 12곳
    const d = structuredClone(db);
    d.gardens.find((g) => g.id === 'g13')!.status = '지정';
    expect(typeStats(d).total).toBe(13);
  });

  it('행정동별: 구획 수가 많은 순, 합계가 전체와 같다', () => {
    const rows = dongStats(db);
    expect(rows.reduce((s, r) => s + r.gardens, 0)).toBe(12);
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].plots).toBeGreaterThanOrEqual(rows[i].plots);
    const jangok = rows.find((r) => r.dong === '장곡동')!;
    expect(jangok).toEqual({ dong: '장곡동', gardens: 2, plots: 30 + 14 });
  });
});

describe('우선 배정 대상 비율', () => {
  it('가을: 60건 중 12건(20%), 유형별·확인 여부', () => {
    const p = priorityStats(db, '2026-가을');
    expect(p).toMatchObject({ total: 60, priority: 12, verified: 7, unverified: 5 });
    expect(p.share).toBeCloseTo(0.2, 5);
    expect(p.byKind.map((k) => k.count)).toEqual([5, 3, 4]);
    expect(p.byKind.reduce((s, k) => s + k.count, 0)).toBe(12);
    expect(p.verified + p.unverified).toBe(p.priority);
  });

  it('신청이 없는 시즌은 비율이 null', () => {
    expect(priorityStats(db, '2030-봄').share).toBeNull();
  });
});
