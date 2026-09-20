import { FileText } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useDb, useSession } from '../../data/useDb';
import { Logo } from '../Logo';

export function CommitteeLayout() {
  const { user } = useSession();
  const db = useDb();
  const member = db.members.find((m) => m.id === user.memberId);

  return (
    <>
      <header className="border-b border-soil-200 bg-paper">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <Logo to="/committee" title="도시농업위원회 심의" sub="시연" />
          <p className="text-sm">
            <span className="font-bold">{user.name}</span> 위원 · <span className="muted">{member ? `${member.position} · ${member.category}` : '심의위원'}</span>
          </p>
        </div>
        <nav aria-label="심의위원 메뉴" className="mx-auto max-w-5xl px-4">
          <NavLink
            to="/committee"
            end
            className={({ isActive }) =>
              `inline-flex min-h-12 items-center gap-2 border-b-4 px-4 font-bold no-underline ${
                isActive ? 'border-leaf-700 text-leaf-800' : 'border-transparent text-soil-700 hover:bg-leaf-50'
              }`
            }
          >
            <FileText aria-hidden className="size-5" /> 안건 목록
          </NavLink>
        </nav>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 outline-none">
        <Outlet />
      </main>
    </>
  );
}
