// 등록·심의 흐름의 상태 변경. 규칙은 lib/workflow.ts(순수 로직)에 있고, 여기서는 저장소에 연결만 한다.
import * as wf from '../lib/workflow';
import { me, run } from './run';

export const registerGarden = (input: Parameters<typeof wf.submitRegistration>[1]) => run((d) => wf.submitRegistration(d, input, me()));
export const resubmitSupplement = (gardenId: string, input: Parameters<typeof wf.resubmitSupplement>[2]) => run((d) => wf.resubmitSupplement(d, gardenId, input));
export const requestSupplement = (gardenId: string, note: string) => run((d) => wf.requestSupplement(d, gardenId, note));
export const approveForCommittee = (gardenId: string, checklist: Record<string, boolean>, opinion: string) =>
  run((d) => wf.approveForCommittee(d, gardenId, checklist, opinion, me()));

export const createMeeting = (input: wf.MeetingInput) => run((d) => wf.createMeeting(d, input, me()));
export const addAgenda = (input: wf.AgendaInput) => run((d) => wf.addAgenda(d, input, me()));
export const removeAgenda = (agendaId: string) => run((d) => wf.removeAgenda(d, agendaId, me()));
export const setAttendance = (meetingId: string, memberId: string, present: boolean) => run((d) => wf.setAttendance(d, meetingId, memberId, present));
export const setAttendanceBulk = (meetingId: string, memberIds: string[]) => run((d) => wf.setAttendanceBulk(d, meetingId, memberIds, me()));
export const openMeeting = (meetingId: string) => run((d) => wf.openMeeting(d, meetingId, me()));
export const castVote = (input: Parameters<typeof wf.castVote>[1]) => run((d) => wf.castVote(d, input));
export const autoVote = (agendaId: string, mode: 'yes' | 'short') => run((d) => wf.autoVote(d, agendaId, mode, me()));
export const decideAgenda = (input: wf.DecideInput) => run((d) => wf.decideAgenda(d, input, me()));
export const correctAgenda = (agendaId: string, note: string) => run((d) => wf.correctAgenda(d, agendaId, note, me()));
export const closeMeeting = (meetingId: string) => run((d) => wf.closeMeeting(d, meetingId, me()));
export const migrateGarden = (input: wf.MigrateInput) => run((d) => wf.migrateGarden(d, input, me()));
