import {
  BarChart3,
  ClipboardCheck,
  Gavel,
  LayoutDashboard,
  Megaphone,
  Menu,
  Shuffle,
  TriangleAlert,
  UserPen,
  Users,
  Sprout,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../../data/useDb';
import { DEPARTMENT } from '../../config';
import { Logo } from '../Logo';

const ITEMS: { to: string; label: string; Icon: LucideIcon; end?: boolean }[] = [
  { to: '/admin', label: '대시보드', Icon: LayoutDashboard, end: true },
  { to: '/admin/review', label: '등록 실무 검수', Icon: ClipboardCheck },
  { to: '/admin/committee', label: '위원회 관리', Icon: Gavel },
  { to: '/admin/recruitments', label: '모집 관리', Icon: Sprout },
  { to: '/admin/draw', label: '추첨 · 감사 로그', Icon: Shuffle },
  { to: '/admin/allocations', label: '분양·이용자', Icon: Users },
  { to: '/admin/warnings', label: '경고·회수', Icon: TriangleAlert },
  { to: '/admin/notices', label: '공지·알림', Icon: Megaphone },
  { to: '/admin/stats', label: '통계', Icon: BarChart3 },
  { to: '/admin/proxy', label: '대리 신청 입력', Icon: UserPen },
];

export function AdminLayout() {
  const { user, isSecretary } = useSession();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  // 화면을 이동하면 모바일 메뉴를 닫는다
  useEffect(() => setOpen(false), [pathname]);

  const nav = (
    <nav aria-label="관리자 메뉴">
      <ul className="space-y-1">
        {ITEMS.map(({ to, label, Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-12 items-center gap-3 rounded-lg px-3 font-bold no-underline ${
                  isActive ? 'bg-leaf-700 text-white' : 'text-soil-700 hover:bg-leaf-100'
                }`
              }
            >
              <Icon aria-hidden className="size-5 shrink-0" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );

  return (
    <>
      <header className="border-b border-soil-200 bg-paper">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Logo to="/admin" title={`${DEPARTMENT} 관리`} sub="시연" />
          <p className="hidden text-sm sm:block">
            <span className="font-bold">{user.name}</span> · <span className="muted">{isSecretary ? '도시농업 담당주무관(위원회 간사)' : '관리자'}</span>
          </p>
          <button
            type="button"
            className="btn btn-secondary !min-h-11 lg:hidden"
            aria-expanded={open}
            aria-controls="admin-nav-mobile"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />} 메뉴
          </button>
        </div>
        {open && (
          <div id="admin-nav-mobile" className="border-t border-soil-200 bg-paper px-4 py-3 lg:hidden">
            {nav}
          </div>
        )}
      </header>

      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="hidden lg:block">{nav}</aside>
        <main id="main" tabIndex={-1} className="min-w-0 outline-none">
          <Outlet />
        </main>
      </div>
    </>
  );
}
