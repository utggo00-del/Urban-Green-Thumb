import { ArrowLeft } from 'lucide-react';
import { Link, Outlet } from 'react-router-dom';
import { DEMO_ROLES } from '../../config';
import { useSession } from '../../data/useDb';
import { Logo } from '../Logo';

/** 근거 조례·개인정보 처리방침처럼 모든 역할이 보는 공통 화면 */
export function PlainLayout() {
  const { role } = useSession();
  const home = DEMO_ROLES[role].home;
  return (
    <>
      <header className="border-b border-soil-200 bg-paper">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Logo to={home} />
          <Link to={home} className="btn btn-secondary !min-h-11">
            <ArrowLeft aria-hidden className="size-4" /> 처음 화면으로
          </Link>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 outline-none">
        <Outlet />
      </main>
    </>
  );
}
