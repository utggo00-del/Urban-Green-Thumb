import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { DEMO_ROLES } from '../config';
import { repo, useSession } from '../data/useDb';
import { usePageTitle } from '../lib/usePageTitle';
import type { DemoRole } from '../types';
import { Logo } from './Logo';

/**
 * 역할별 접근 제어. 프로토타입에서는 상단 역할 전환 스위치가 "로그인"을 대신한다.
 * 실서비스에서는 이 자리를 인증·권한 검사(세션/토큰)로 교체한다.
 * 예: 심의위원 계정은 추첨·경고·이용자 개인정보 화면에 접근할 수 없다.
 */
export function RequireRole({ roles, children }: { roles: DemoRole[]; children: ReactNode }) {
  const { role } = useSession();
  return roles.includes(role) ? <>{children}</> : <AccessDenied roles={roles} />;
}

function AccessDenied({ roles }: { roles: DemoRole[] }) {
  const { roleLabel } = useSession();
  usePageTitle('접근 권한 없음');
  const target = roles[0];

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10">
      <div className="mb-6">
        <Logo />
      </div>
      <main id="main" tabIndex={-1} className="card space-y-4">
        <h1 className="flex items-center gap-2 text-xl font-extrabold">
          <Lock aria-hidden className="size-6 text-clay-700" /> 접근 권한이 없는 화면입니다
        </h1>
        <p>
          현재 역할은 <strong>{roleLabel}</strong>입니다. 이 화면은{' '}
          <strong>{roles.map((r) => DEMO_ROLES[r].label).join(' · ')}</strong> 역할만 볼 수 있습니다.
        </p>
        <p className="muted text-sm">개인정보·추첨·경고 등 운영 화면은 역할에 따라 분리되어 있습니다. (시연용 역할 전환)</p>
        <button type="button" className="btn btn-primary w-full sm:w-auto" onClick={() => repo.setRole(target)}>
          {DEMO_ROLES[target].label} 역할로 전환
        </button>
      </main>
    </div>
  );
}
