import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { RegistrationForm } from '../../components/RegistrationForm';
import { useSession } from '../../data/useDb';
import { usePageTitle } from '../../lib/usePageTitle';
import { NextMeetingNotice } from './Register';

export default function RegisterNew() {
  usePageTitle('새 텃밭 등록');
  const { user } = useSession();
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to="/register" className="inline-flex min-h-12 items-center gap-1 font-bold">
        <ArrowLeft aria-hidden className="size-5" /> 내 등록 목록
      </Link>
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">새 텃밭 등록 신청</h1>
        <p className="muted">
          개인·민간 소유자는 누구나 신청할 수 있어요. 신청하면 <strong>실무 검수 → 위원회 심의 → 지정</strong> 순서로 진행돼요. 위원회 심의를 거쳐 지정되기 전에는 시민에게 공개되지 않습니다. (조례 제5조, 제11조)
        </p>
      </div>
      <NextMeetingNotice />
      <RegistrationForm mode="register" typeOptions={['개인', '민간']} owners={[user]} onDone={(id) => navigate('/register', { state: { justRegistered: id } })} />
    </div>
  );
}
