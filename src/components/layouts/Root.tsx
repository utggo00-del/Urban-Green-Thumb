import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { DemoBar } from '../DemoBar';
import { ErrorBoundary } from '../ErrorBoundary';
import { Footer } from '../Footer';

/** 모든 화면 공통: 건너뛰기 링크, 시연 바, 푸터. 화면 이동 시 맨 위로 스크롤한다. */
export function Root() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      {/* HashRouter에서는 #앵커 링크가 경로를 바꾸므로 버튼 동작으로 본문에 포커스를 준다 */}
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          const main = document.getElementById('main');
          main?.focus();
          main?.scrollIntoView();
        }}
        className="absolute left-2 top-2 z-50 -translate-y-20 rounded-lg bg-clay-700 px-4 py-3 font-bold text-white focus:translate-y-0"
      >
        본문 바로가기
      </a>
      <DemoBar />
      <div className="flex flex-1 flex-col">
        <ErrorBoundary resetKey={pathname}>
          <Outlet />
        </ErrorBoundary>
      </div>
      <Footer />
    </div>
  );
}
