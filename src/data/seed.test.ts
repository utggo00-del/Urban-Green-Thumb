import { describe, expect, it } from 'vitest';
import { COMMITTEE_RULES } from '../config';
import { buildSeed } from './seed';

// SPEC 8.1 시드 데이터 요건을 그대로 검증한다.
describe('시드 데이터 (SPEC 8.1)', () => {
  const db = buildSeed();

  it('지정 12곳(공공 5·민간 4·개인 3), 심의대기 2곳, 보류/부결 1곳, 별개의 검수중 1곳', () => {
    const designated = db.gardens.filter((g) => g.status === '지정');
    expect(designated).toHaveLength(12);
    expect(designated.filter((g) => g.type === '공공')).toHaveLength(5);
    expect(designated.filter((g) => g.type === '민간')).toHaveLength(4);
    expect(designated.filter((g) => g.type === '개인')).toHaveLength(3);
    expect(db.gardens.filter((g) => g.status === '심의대기')).toHaveLength(2);
    expect(db.gardens.filter((g) => g.status === '보류' || g.status === '부결')).toHaveLength(1);
    expect(db.gardens.filter((g) => g.status === '검수중')).toHaveLength(1);
    expect(db.gardens).toHaveLength(16);
  });

  it('조례상 유형이 섞여 있다 (상자텃밭 1~2, 학습·생태체험텃밭 1~2)', () => {
    const count = (t: string) => db.gardens.filter((g) => g.status === '지정' && g.ordinanceType === t).length;
    expect(count('상자텃밭')).toBeGreaterThanOrEqual(1);
    expect(count('상자텃밭')).toBeLessThanOrEqual(2);
    expect(count('학습·생태체험텃밭')).toBeGreaterThanOrEqual(1);
    expect(count('학습·생태체험텃밭')).toBeLessThanOrEqual(2);
    expect(count('도시텃밭')).toBeGreaterThan(count('상자텃밭'));
  });

  it('구획 수 8~40, 구획 면적 약 10~16㎡', () => {
    for (const g of db.gardens) {
      expect(g.plotCount).toBeGreaterThanOrEqual(8);
      expect(g.plotCount).toBeLessThanOrEqual(40);
      expect(g.plotAreaM2).toBeGreaterThanOrEqual(10);
      expect(g.plotAreaM2).toBeLessThanOrEqual(16);
    }
  });

  it('지정된 텃밭만 심의 기록(designation)을 가지고, 모집도 지정 텃밭에만 있다', () => {
    const byId = new Map(db.gardens.map((g) => [g.id, g]));
    for (const g of db.gardens) expect(!!g.designation).toBe(g.status === '지정');
    for (const r of db.recruitments) expect(byId.get(r.gardenId)?.status).toBe('지정');
  });

  it('민간·개인 텃밭만 계좌를 가지고, 모든 텃밭에 소유자 동의서가 있다', () => {
    for (const g of db.gardens) {
      expect(!!g.feeAccount).toBe(g.type !== '공공');
      expect(g.ownerConsentDoc).toBeTruthy();
    }
  });

  it('가을 신청자 60명 내외, 우선 배정 대상 약 20%', () => {
    const fall = db.applications.filter((a) => a.recruitmentSeason === '2026-가을');
    expect(fall).toHaveLength(60);
    expect(new Set(fall.map((a) => a.userId)).size).toBe(60); // 1인 1건
    const priority = fall.filter((a) => a.priorityType !== '없음').length;
    expect(priority).toBe(12);
    for (const a of fall) {
      expect(a.choices.length).toBeGreaterThanOrEqual(1);
      expect(a.choices.length).toBeLessThanOrEqual(3);
      expect(new Set(a.choices).size).toBe(a.choices.length);
    }
  });

  it('추첨 시연용: 신청자가 정원을 넘는 마감 텃밭과 무추첨 전원 배정 텃밭이 있다', () => {
    const fall = db.applications.filter((a) => a.recruitmentSeason === '2026-가을');
    const demand = (gid: string) => fall.filter((a) => a.choices[0] === gid).length;
    const closed = db.recruitments.filter((r) => r.season === '가을' && r.status === '마감');
    expect(closed.length).toBeGreaterThanOrEqual(1);
    for (const r of closed) expect(demand(r.gardenId)).toBeGreaterThan(r.plotsOffered);
    const open = db.recruitments.filter((r) => r.season === '가을' && r.status === '모집중');
    expect(open.some((r) => demand(r.gardenId) > 0 && demand(r.gardenId) <= r.plotsOffered)).toBe(true);
  });

  it('모집 구획 수는 해당 텃밭의 공실 구획 수를 넘지 않는다', () => {
    for (const r of db.recruitments.filter((x) => x.season === '가을')) {
      const vacant = db.plots.filter((p) => p.gardenId === r.gardenId && p.status === '공실').length;
      expect(r.plotsOffered).toBeLessThanOrEqual(vacant);
    }
  });

  it('경고 1·2회 이용자가 있고, 3회 직전(2회) 이용자가 1명이며 그 구획 텃밭은 추첨 대상이다', () => {
    const counts = db.plots.map((p) => p.warningCount);
    expect(counts.filter((c) => c === 1).length).toBeGreaterThanOrEqual(1);
    const two = db.plots.filter((p) => p.warningCount === db.settings.warningLimit - 1);
    expect(two).toHaveLength(1);
    expect(db.recruitments.some((r) => r.gardenId === two[0].gardenId && r.status === '마감')).toBe(true);
    expect(db.plots.filter((p) => p.status === '회수대기')).toHaveLength(0);
  });

  it('구획의 warningCount는 경고 기록 수와 일치한다', () => {
    for (const p of db.plots) {
      expect(db.warnings.filter((w) => w.plotId === p.id)).toHaveLength(p.warningCount);
    }
  });

  it('위원 12명(15명 이내), 위원장·부위원장 포함, 조례 제4조 분류를 모두 사용한다', () => {
    expect(db.members).toHaveLength(12);
    expect(db.members.length).toBeLessThanOrEqual(COMMITTEE_RULES.maxMembers);
    expect(db.members.filter((m) => m.position === '위원장')).toHaveLength(1);
    expect(db.members.filter((m) => m.position === '부위원장')).toHaveLength(1);
    expect(new Set(db.members.map((m) => m.category)).size).toBe(5);
    // 조례 제4조 제2항: 시의회 추천 1명, 농업기술센터 소장(당연직) 1명
    expect(db.members.filter((m) => m.category === '시의회 추천')).toHaveLength(1);
    expect(db.members.filter((m) => m.category === '농업기술센터 소장(당연직)')).toHaveLength(1);
  });

  it('회의: 2026 상반기 정례(종료), 2026 하반기 정례(예정), 안건은 결과가 기록되어 있다', () => {
    const h1 = db.meetings.find((m) => m.year === 2026 && m.half === '상반기');
    const h2 = db.meetings.find((m) => m.year === 2026 && m.half === '하반기');
    expect(h1?.status).toBe('종료');
    expect(h1?.kind).toBe('정례');
    expect(h2?.status).toBe('예정');
    expect(db.agendas.filter((a) => a.meetingId === h1!.id).some((a) => a.result === '가결')).toBe(true);
    expect(db.agendas.filter((a) => a.meetingId === h2!.id)).toHaveLength(0); // 심의대기 2건을 간사가 상정
    // 종료된 회의의 안건은 가결 요건과 일치한다 (출석 과반 찬성)
    for (const a of db.agendas.filter((x) => x.result === '가결')) {
      const m = db.meetings.find((x) => x.id === a.meetingId)!;
      expect(m.quorumMet).toBe(true);
      expect(a.yes).toBeGreaterThan(m.attendeeCount / 2);
    }
  });

  it('회수·승계 시연: 정례회의 일정이 시연 기준일 이후이고 D-day가 계산된다', () => {
    const next = db.meetings.filter((m) => m.status === '예정').map((m) => m.scheduledAt.slice(0, 10));
    expect(next.every((d) => d >= db.meta.today)).toBe(true);
  });

  it('참조 무결성: 신청·구획·경고가 존재하는 사용자·텃밭을 가리킨다', () => {
    const users = new Set(db.users.map((u) => u.id));
    const gardens = new Set(db.gardens.map((g) => g.id));
    for (const a of db.applications) {
      expect(users.has(a.userId)).toBe(true);
      a.choices.forEach((c) => expect(gardens.has(c)).toBe(true));
    }
    for (const p of db.plots) {
      expect(gardens.has(p.gardenId)).toBe(true);
      if (p.userId) expect(users.has(p.userId)).toBe(true);
    }
    for (const g of db.gardens) expect(users.has(g.ownerId)).toBe(true);
    for (const w of db.warnings) expect(users.has(w.userId)).toBe(true);
  });

  it('시연 계정: 시민 3종(타 지역 포함)·제공자·간사 관리자·심의위원이 있다', () => {
    const u = (id: string) => db.users.find((x) => x.id === id);
    expect(u('u_c001')?.isSiheungResident).toBe(true);
    expect(u('u_c002')?.priorityTypes).toContain('다자녀');
    expect(u('u_c003')?.isSiheungResident).toBe(false);
    expect(u('u_o_prov')?.role).toBe('제공자');
    expect(u('u_admin1')?.isCommitteeSecretary).toBe(true);
    expect(db.members.some((m) => m.id === u('u_member05')?.memberId)).toBe(true);
    // 시연 시민은 가을 신청 내역이 없어 처음부터 신청해 볼 수 있다
    for (const id of ['u_c001', 'u_c002', 'u_c003']) {
      expect(db.applications.some((a) => a.userId === id && a.recruitmentSeason === '2026-가을')).toBe(false);
    }
  });

  it('같은 시드는 항상 같은 데이터를 만든다 (초기화 재현성)', () => {
    expect(JSON.stringify(buildSeed())).toBe(JSON.stringify(buildSeed()));
  });
});
