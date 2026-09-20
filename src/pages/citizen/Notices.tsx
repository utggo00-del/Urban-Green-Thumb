import { Megaphone } from 'lucide-react';
import { Badge } from '../../components/Badge';
import { noticesFor } from '../../data/selectors';
import { useDb, useSession } from '../../data/useDb';
import { formatDate } from '../../lib/date';
import { usePageTitle } from '../../lib/usePageTitle';

/** 시민·제공자가 볼 수 있는 공지 전체 목록 (중요 공지가 먼저) */
export default function Notices() {
  usePageTitle('공지');
  const db = useDb();
  const { role } = useSession();
  const list = noticesFor(db, role === 'provider' ? '제공자' : '이용자');

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold sm:text-3xl">
          <Megaphone aria-hidden className="size-7" /> 공지
        </h1>
        <p className="muted">텃밭지원과(가칭)가 알려 드리는 소식이에요.</p>
      </div>
      {list.length === 0 ? (
        <div className="card muted">등록된 공지가 없어요.</div>
      ) : (
        <ul className="space-y-3">
          {list.map((n) => (
            <li key={n.id} className="card space-y-1">
              <p className="flex flex-wrap items-center gap-2 text-lg font-extrabold">
                {n.pinned && <Badge tone="info">중요</Badge>}
                {n.title}
              </p>
              <p className="muted text-sm">{formatDate(n.createdAt)}</p>
              <p>{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
