// 경고·회수의 상태 변경. 규칙은 lib/warnings.ts(순수 로직)에 있다.
import * as wn from '../lib/warnings';
import { me, run } from './run';

export const issueWarning = (input: wn.IssueInput) => run((d) => wn.issueWarning(d, input, me()));
export const confirmRecall = (plotId: string) => run((d) => wn.confirmRecall(d, plotId, me()));
