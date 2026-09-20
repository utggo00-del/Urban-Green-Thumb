import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Notice } from '../../components/Badge';
import { RegistrationForm } from '../../components/RegistrationForm';
import { useDb, useSession } from '../../data/useDb';
import { usePageTitle } from '../../lib/usePageTitle';

/** 이미 심의를 거쳐 조성된 텃밭을 심의 회차·일자를 입력해 ‘지정’ 상태로 등록한다. (SPEC 3.2-3) */
export default function Migrate() {
  usePageTitle('기존 지정 텃밭 이관 입력');
  const db = useDb();
  const { isSecretary } = useSession();
  const navigate = useNavigate();
  if (!isSecretary) return <Notice tone="warn">위원회 간사만 이용할 수 있어요.</Notice>;
  return (
    <div className="max-w-3xl space-y-5">
      <Link to="/admin/committee" className="inline-flex min-h-12 items-center gap-1 font-bold">
        <ArrowLeft aria-hidden className="size-5" /> 위원회 관리
      </Link>
      <div>
        <h1 className="text-2xl font-extrabold">기존 지정 텃밭 이관 입력</h1>
        <p className="muted">이미 도시농업위원회 심의를 거쳐 조성된 텃밭이에요. 회차와 일자를 입력하면 바로 ‘지정’ 상태가 되어 시민에게 공개돼요. (조례 제11조)</p>
      </div>
      <RegistrationForm mode="migrate" typeOptions={['공공', '민간', '개인']} owners={db.users.filter((u) => u.role === '제공자')} onDone={(id) => navigate('/admin/committee', { state: { migrated: id } })} />
    </div>
  );
}
