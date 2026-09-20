// 모집·추첨·수락·승계의 상태 변경. 규칙은 lib/recruitment.ts, lib/allocation.ts(순수 로직)에 있다.
import * as al from '../lib/allocation';
import * as rc from '../lib/recruitment';
import { me, run } from './run';

export const openRecruitment = (input: rc.RecruitmentInput) => run((d) => rc.openRecruitment(d, input, me()));
export const updateRecruitment = (id: string, patch: rc.RecruitmentPatch) => run((d) => rc.updateRecruitment(d, id, patch, me()));
export const startRecruitment = (id: string) => run((d) => rc.setRecruitmentStatus(d, id, '모집중', me()));
export const closeRecruitment = (id: string) => run((d) => rc.setRecruitmentStatus(d, id, '마감', me()));
export const removeRecruitment = (id: string) => run((d) => rc.removeRecruitment(d, id, me()));

export const verifyPriority = (applicationId: string) => run((d) => al.verifyPriority(d, applicationId, me()));
export const runDraw = (groupId: string, seed: number) => run((d) => al.runDraw(d, groupId, seed, me()));
export const confirmDraw = (groupId: string) => run((d) => al.confirmDraw(d, groupId, me()));
export const discardDraw = (groupId: string, reason: string) => run((d) => al.discardDraw(d, groupId, reason, me()));

/** 시민 본인의 수락·포기 (현재 로그인한 시연 계정) */
export const acceptOffer = (applicationId: string) => run((d) => al.acceptOffer(d, applicationId, me()));
export const declineOffer = (applicationId: string) => run((d) => al.declineOffer(d, applicationId, me()));

export const advanceDays = (days: number) => run((d) => al.advanceDays(d, days, me()));
