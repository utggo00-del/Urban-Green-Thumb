import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { RegistrationForm } from '../../components/RegistrationForm';
import { useDb } from '../../data/useDb';
import { usePageTitle } from '../../lib/usePageTitle';

/** 공공 텃밭(시 소유 유휴지, 공공기관 유휴 공간)은 텃밭지원과가 대리 등록한다. 이후 절차는 민간·개인과 같다. */
export default function ReviewNew() {
  usePageTitle('공공 텃밭 등록 입력');
  const db = useDb();
  const navigate = useNavigate();
  return (
    <div className="max-w-3xl space-y-5">
      <Link to="/admin/review" className="inline-flex min-h-12 items-center gap-1 font-bold">
        <ArrowLeft aria-hidden className="size-5" /> 검수 목록
      </Link>
      <div>
        <h1 className="text-2xl font-extrabold">공공 텃밭 등록 입력</h1>
        <p className="muted">공공 텃밭도 민간·개인과 똑같이 실무 검수 → 위원회 심의를 거쳐 지정돼요. (조례 제11조: 시 소유 유휴지, 공공기관 유휴 공간)</p>
      </div>
      <RegistrationForm mode="register" typeOptions={['공공', '민간', '개인']} owners={db.users.filter((u) => u.role === '제공자')} onDone={(id) => navigate(`/admin/review/${id}`)} />
    </div>
  );
}
