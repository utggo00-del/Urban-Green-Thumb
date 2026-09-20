import { ClipboardList, FilePlus2, House, MapPin, Sprout, type LucideIcon } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useSession } from '../../data/useDb';
import { Logo } from '../Logo';

// 한 계정이 신청자와 제공자를 겸할 수 있으므로 하나의 메뉴로 자연스럽게 이동한다. (SPEC 3.1)
const ITEMS: { to: string; label: string; Icon: LucideIcon; end?: boolean }[] = [
  { to: '/', label: '홈', Icon: House, end: true },
  { to: '/gardens', label: '텃밭 찾기', Icon: MapPin },
  { to: '/my/applications', label: '내 신청', Icon: ClipboardList },
  { to: '/my/plots', label: '내 텃밭', Icon: Sprout },
  { to: '/register', label: '텃밭 등록', Icon: FilePlus2 },
];

export function CitizenLayout() {
  const { user, roleLabel } = useSession();

  return (
    <>
      <header className="border-b border-soil-200 bg-paper">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Logo />
          <p className="hidden text-sm sm:block" aria-label="현재 사용자">
            <span className="font-bold">{user.name}</span>님 · <span className="muted">{roleLabel}</span>
          </p>
        </div>
        <nav aria-label="주 메뉴" className="mx-auto hidden max-w-5xl gap-1 px-4 lg:flex">
          {ITEMS.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `inline-flex min-h-12 items-center gap-2 border-b-4 px-4 font-bold no-underline ${
                  isActive ? 'border-leaf-700 text-leaf-800' : 'border-transparent text-soil-700 hover:bg-leaf-50'
                }`
              }
            >
              <Icon aria-hidden className="size-5" />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 outline-none">
        <Outlet />
      </main>

      {/* 모바일: 하단 탭 (아이콘 + 글자 병행) */}
      <nav aria-label="주 메뉴(모바일)" className="fixed inset-x-0 bottom-0 z-30 border-t border-soil-200 bg-paper lg:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {ITEMS.map(({ to, label, Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex min-h-16 flex-col items-center justify-center gap-0.5 px-1 text-sm font-bold no-underline ${
                    isActive ? 'bg-leaf-100 text-leaf-800' : 'text-soil-700'
                  }`
                }
              >
                <Icon aria-hidden className="size-6" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
