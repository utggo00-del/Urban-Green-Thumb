import { BookOpenCheck, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEMO_CITIZEN_ACCOUNTS, DEMO_ROLES, DEMO_ROLE_ORDER } from '../config';
import { getUser } from '../data/selectors';
import { repo, useDb, useSession } from '../data/useDb';
import { formatDate } from '../lib/date';
import type { DemoRole } from '../types';
import { GuideDialog } from './GuideDialog';

const CITIZEN_GROUP: DemoRole[] = ['citizen', 'provider'];
const barBtn =
  'inline-flex min-h-10 items-center gap-1.5 rounded-lg border-2 border-cream/40 bg-leaf-700 px-3 text-sm font-bold text-cream hover:bg-leaf-600';

/**
 * 시연 편의 바 (SPEC 3.5). 로그인 없이 역할을 바꾸고, 데이터를 초기화하고, 시연 가이드를 연다.
 * 실서비스에서는 이 바 전체가 제거되고 실제 인증(시민 본인인증·공무원 계정)으로 대체된다.
 */
export function DemoBar() {
  const { role, user, today } = useSession();
  const db = useDb();
  const navigate = useNavigate();
  const [guideOpen, setGuideOpen] = useState(false);

  const switchRole = (next: DemoRole) => {
    if (next === role) return;
    repo.setRole(next);
    // 시민 ↔ 제공자는 같은 메뉴를 쓰므로 화면을 유지하고, 그 외에는 해당 역할 홈으로 이동
    if (!(CITIZEN_GROUP.includes(role) && CITIZEN_GROUP.includes(next))) navigate(DEMO_ROLES[next].home);
  };

  const reset = () => {
    if (!window.confirm('시연 데이터를 처음 상태로 되돌립니다. 지금까지 입력한 내용은 사라집니다. 계속할까요?')) return;
    repo.reset();
    navigate('/');
  };

  return (
    <div className="bg-leaf-800 text-cream">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-2 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm leading-snug">
          <strong>시연용 가상 데이터</strong> · 기준일 {formatDate(today)}
          <span className="hidden sm:inline"> · 로그인 없이 역할을 바꿔 볼 수 있어요</span>
          <span className="hidden xl:inline"> (실서비스에서는 인증으로 대체)</span>
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div role="group" aria-label="시연 역할 전환" className="grid grid-cols-2 gap-1 sm:flex">
            {DEMO_ROLE_ORDER.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={role === r}
                onClick={() => switchRole(r)}
                className={`min-h-10 rounded-lg border-2 px-3 text-sm font-bold ${
                  role === r ? 'border-cream bg-cream text-leaf-800' : 'border-cream/40 bg-leaf-700 text-cream hover:bg-leaf-600'
                }`}
              >
                {DEMO_ROLES[r].label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {role === 'citizen' && (
              <select
                aria-label="시연 시민 계정"
                value={user.id}
                onChange={(e) => repo.setRole('citizen', e.target.value)}
                className="min-h-10 max-w-full rounded-lg border-2 border-cream/40 bg-leaf-700 px-2 text-sm font-bold text-cream"
              >
                {DEMO_CITIZEN_ACCOUNTS.map((a) => (
                  <option key={a.userId} value={a.userId}>
                    {getUser(db, a.userId)?.name} · {a.hint}
                  </option>
                ))}
              </select>
            )}
            <button type="button" onClick={() => setGuideOpen(true)} className={barBtn}>
              <BookOpenCheck aria-hidden className="size-4" /> 시연 가이드
            </button>
            <button type="button" onClick={reset} className={barBtn}>
              <RotateCcw aria-hidden className="size-4" /> 데이터 초기화
            </button>
          </div>
        </div>
      </div>
      <GuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}
