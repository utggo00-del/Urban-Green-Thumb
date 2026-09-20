import { Link } from 'react-router-dom';
import { DEPARTMENT, ORDINANCE } from '../config';

export function Footer() {
  return (
    <footer className="mt-10 border-t border-soil-200 bg-soil-100 pb-24 text-soil-700 lg:pb-0">
      <div className="mx-auto max-w-6xl space-y-2 px-4 py-6 text-sm">
        <nav aria-label="하단 메뉴" className="flex flex-wrap gap-x-5 gap-y-1 font-bold">
          <Link to="/ordinance">근거 조례</Link>
          <Link to="/privacy">개인정보 처리방침</Link>
        </nav>
        <p>
          운영·개인정보 책임 부서: {DEPARTMENT} · 근거: 「{ORDINANCE.name}」({ORDINANCE.number}, {ORDINANCE.effectiveFrom} 시행)
        </p>
        <p>
          이 화면은 시흥시 AI 챌린지 제출용 프로토타입이며, 모든 사람 이름·계좌·전화번호·텃밭 이름은 <strong>시연용 가상 데이터</strong>입니다.
          부서명 “텃밭지원과”는 가칭입니다.
        </p>
      </div>
    </footer>
  );
}
