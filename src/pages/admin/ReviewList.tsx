import { ChevronRight, FilePlus2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Notice } from '../../components/Badge';
import { getUser } from '../../data/selectors';
import { useDb } from '../../data/useDb';
import { formatDate } from '../../lib/date';
import { usePageTitle } from '../../lib/usePageTitle';

/** 실무 검수 대기 목록. 통과한 건은 심의대기가 되어 간사가 안건으로 묶는다. */
export default function ReviewList() {
  usePageTitle('등록 실무 검수');
  const db = useDb();
  const waiting = db.gardens.filter((g) => g.status === '검수중').sort((a, b) => Number(!!a.reviewNote) - Number(!!b.reviewNote) || a.createdAt.localeCompare(b.createdAt));
  const forCommittee = db.gardens.filter((g) => g.status === '심의대기' || g.status === '심의중');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">등록 실무 검수</h1>
          <p className="muted">서류와 요건을 확인해 위원회 심의에 상정하거나, 보완을 요청해요. 심의 의결 전에는 시민에게 공개되지 않아요. (조례 제11조)</p>
        </div>
        <Link to="/admin/review/new" className="btn btn-secondary w-full sm:w-auto">
          <FilePlus2 aria-hidden className="size-5" /> 공공 텃밭 등록 입력
        </Link>
      </div>

      <section aria-labelledby="waiting" className="space-y-3">
        <h2 id="waiting" className="text-xl font-bold">
          검수 대기 <span className="text-leaf-700">{waiting.length}건</span>
        </h2>
        {waiting.length === 0 ? (
          <Notice tone="success">검수할 텃밭이 없어요.</Notice>
        ) : (
          <ul className="space-y-3">
            {waiting.map((g) => {
              const owner = getUser(db, g.ownerId);
              return (
                <li key={g.id}>
                  <Link to={`/admin/review/${g.id}`} className="card flex items-center justify-between gap-3 no-underline hover:border-leaf-700 hover:bg-leaf-50">
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <strong className="text-lg text-ink">{g.name}</strong>
                        {g.reviewNote ? <Badge tone="warn">보완 요청 중</Badge> : <Badge tone="info">검수 대기</Badge>}
                      </span>
                      <span className="muted block text-sm">
                        {g.type} · {g.ordinanceType} · {g.dong} · {g.plotCount}구획 · 소유자 {owner?.name} · 신청 {formatDate(g.createdAt)}
                      </span>
                    </span>
                    <ChevronRight aria-hidden className="size-6 shrink-0 text-leaf-700" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="committee" className="space-y-3">
        <h2 id="committee" className="text-xl font-bold">
          심의 상정 완료 <span className="text-leaf-700">{forCommittee.length}건</span>
        </h2>
        <p className="muted text-sm">실무 검수를 통과한 텃밭입니다. 위원회 관리에서 회의 안건으로 상정해 주세요.</p>
        <ul className="space-y-2">
          {forCommittee.map((g) => (
            <li key={g.id} className="card flex flex-wrap items-center justify-between gap-2 !py-3">
              <span>
                <strong>{g.name}</strong> <span className="muted text-sm">{g.type} · {g.dong}</span>
              </span>
              <Badge tone={g.status === '심의중' ? 'warn' : 'info'}>{g.status}</Badge>
            </li>
          ))}
        </ul>
        <Link to="/admin/committee" className="btn btn-secondary w-full sm:w-auto">
          위원회 관리로 이동
        </Link>
      </section>
    </div>
  );
}
