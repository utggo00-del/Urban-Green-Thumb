import type { AgendaResult, ApplicationStatus, Garden, GardenStatus, MeetingStatus, PlotStatus, RecruitmentStatus } from '../types';

export type Tone = 'neutral' | 'info' | 'success' | 'warn' | 'danger';

/** 상태는 색만으로 구분하지 않는다: 톤(색+아이콘)과 텍스트를 항상 함께 쓴다. */
export const APPLICATION_STATUS: Record<ApplicationStatus, { label: string; tone: Tone }> = {
  접수: { label: '신청완료', tone: 'info' },
  추첨대기: { label: '추첨대기', tone: 'info' },
  당첨: { label: '당첨', tone: 'success' },
  대기: { label: '대기', tone: 'warn' },
  낙첨: { label: '낙첨', tone: 'neutral' },
  수락: { label: '수락(이용중)', tone: 'success' },
  포기: { label: '포기', tone: 'neutral' },
  취소: { label: '취소', tone: 'neutral' },
};

export const GARDEN_STATUS: Record<GardenStatus, { label: string; tone: Tone }> = {
  검수중: { label: '검수중', tone: 'info' },
  심의대기: { label: '심의대기', tone: 'info' },
  심의중: { label: '심의중', tone: 'warn' },
  지정: { label: '지정(공개)', tone: 'success' },
  부결: { label: '부결', tone: 'danger' },
  보류: { label: '보류', tone: 'warn' },
  운영중: { label: '운영중', tone: 'success' },
  중단: { label: '중단', tone: 'neutral' },
};

export const RECRUITMENT_STATUS: Record<RecruitmentStatus, { label: string; tone: Tone }> = {
  준비: { label: '모집 준비', tone: 'neutral' },
  모집중: { label: '모집중', tone: 'success' },
  마감: { label: '마감', tone: 'warn' },
  추첨완료: { label: '추첨완료', tone: 'neutral' },
};

export const PLOT_STATUS: Record<PlotStatus, { label: string; tone: Tone }> = {
  공실: { label: '공실', tone: 'neutral' },
  배정: { label: '배정', tone: 'info' },
  이용중: { label: '이용중', tone: 'success' },
  회수대기: { label: '회수대기', tone: 'danger' },
  회수: { label: '회수', tone: 'neutral' },
};

export const MEETING_STATUS: Record<MeetingStatus, { label: string; tone: Tone }> = {
  예정: { label: '예정', tone: 'info' },
  진행중: { label: '진행중(개회)', tone: 'warn' },
  종료: { label: '종료', tone: 'neutral' },
};

export const AGENDA_RESULT: Record<AgendaResult, { label: string; tone: Tone }> = {
  미의결: { label: '미의결', tone: 'info' },
  가결: { label: '가결', tone: 'success' },
  부결: { label: '부결', tone: 'danger' },
  보류: { label: '보류', tone: 'warn' },
};

/** 텃밭 등록 진행 단계: 검수중 → 심의대기 → 심의중 → 지정/부결/보류 (SPEC 3.1-7) */
export const REGISTRATION_STEPS = ['검수중', '심의대기', '심의중', '결과'] as const;

export function registrationFlow(g: Pick<Garden, 'status'>): { current: number; failed: boolean; resultLabel: string } {
  switch (g.status) {
    case '검수중':
      return { current: 0, failed: false, resultLabel: '결과' };
    case '심의대기':
      return { current: 1, failed: false, resultLabel: '결과' };
    case '심의중':
      return { current: 2, failed: false, resultLabel: '결과' };
    case '지정':
    case '운영중':
      return { current: 3, failed: false, resultLabel: '지정 완료' };
    case '부결':
      return { current: 3, failed: true, resultLabel: '부결' };
    case '보류':
      return { current: 3, failed: false, resultLabel: '보류' };
    default:
      return { current: 3, failed: false, resultLabel: g.status };
  }
}
