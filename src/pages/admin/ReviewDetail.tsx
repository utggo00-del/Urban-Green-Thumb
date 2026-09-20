import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge, KindBadge, Notice } from '../../components/Badge';
import { DocList } from '../../components/DocList';
import { INSPECTION_ITEMS, FACILITY_LABELS } from '../../config';
import { approveForCommittee, requestSupplement } from '../../data/workflowActions';
import { getGarden, getUser } from '../../data/selectors';
import { useDb } from '../../data/useDb';
import { feeLabel, formatDate } from '../../lib/date';
import { usePageTitle } from '../../lib/usePageTitle';

export default function ReviewDetail() {
  const { id = '' } = useParams();
  const db = useDb();
  const navigate = useNavigate();
  const g = getGarden(db, id);
  usePageTitle(g ? `${g.name} 검수` : '검수');

  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [opinion, setOpinion] = useState('');
  const [supplementOpen, setSupplementOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!g) return <Notice tone="warn">텃밭을 찾을 수 없어요. <Link to="/admin/review">목록으로</Link></Notice>;
  const owner = getUser(db, g.ownerId);
  const reviewable = g.status === '검수중' && !g.reviewNote;
  const allChecked = INSPECTION_ITEMS.every((k) => checked[k]);

  const approve = () => {
    const r = approveForCommittee(g.id, checked, opinion);
    if (!r.ok) return setError(r.error);
    navigate('/admin/review');
  };
  const supplement = () => {
    const r = requestSupplement(g.id, reason);
    if (!r.ok) return setError(r.error);
    navigate('/admin/review');
  };

  return (
    <div className="max-w-3xl space-y-5">
      <Link to="/admin/review" className="inline-flex min-h-12 items-center gap-1 font-bold">
        <ArrowLeft aria-hidden className="size-5" /> 검수 목록
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <KindBadge kind={g.type} />
          <Badge>{g.ordinanceType}</Badge>
          <Badge tone={g.status === '검수중' ? 'info' : 'success'}>{g.status}</Badge>
          {g.reviewNote && g.status === '검수중' && <Badge tone="warn">보완 요청 중</Badge>}
        </div>
        <h1 className="text-2xl font-extrabold">{g.name}</h1>
        <p className="muted">신청일 {formatDate(g.createdAt)} · 소유자 {owner?.name} ({owner?.phone})</p>
      </header>

      <section aria-labelledby="ov" className="card space-y-3">
        <h2 id="ov" className="text-xl font-bold">신청 내용</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          {[
            ['주소', `${g.address}`],
            ['행정동', g.dong],
            ['구획 수 · 면적', `${g.plotCount}개 · 구획당 ${g.plotAreaM2}㎡ (전체 ${g.totalAreaM2.toLocaleString('ko-KR')}㎡)`],
            ['최소 제공 기간', `${g.seasonMinTerm}개월`],
            ['이용료', feeLabel(g.fee)],
            ['시설', g.facilities.length ? g.facilities.map((f) => FACILITY_LABELS[f]).join(', ') : '없음'],
            ...(g.type === '민간' ? [['주말농원사업자', g.isWeekendFarmOperator ? '예(도시텃밭운영자)' : '아니오']] : []),
            ...(g.feeAccount ? [['이용료 계좌(가상)', `${g.feeAccount.bank} ${g.feeAccount.number} (${g.feeAccount.holder})`]] : []),
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="muted text-sm">{k}</dt>
              <dd className="font-bold">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="muted text-sm">이용 규칙: {g.rules}</p>
      </section>

      <section aria-labelledby="docs" className="card space-y-4">
        <h2 id="docs" className="text-xl font-bold">첨부 서류</h2>
        <DocList title="토지 서류" files={g.documents} />
        <DocList title="소유자 동의서 (조례 제11조 필수)" files={g.ownerConsentDoc ? [g.ownerConsentDoc] : []} note="열람은 모의입니다. 프로토타입은 파일명만 보관해요." />
      </section>

      {g.reviewNote && g.status === '검수중' && (
        <Notice tone="warn">
          <p className="font-bold">보완 요청 중</p>
          <p>{g.reviewNote}</p>
          <p className="text-sm">제공자가 자료를 다시 제출하면 검수할 수 있어요.</p>
        </Notice>
      )}

      {reviewable ? (
        <section aria-labelledby="check" className="card space-y-4 border-leaf-700">
          <h2 id="check" className="text-xl font-bold">요건 확인</h2>
          <fieldset className="space-y-2">
            <legend className="sr-only">실무 검수 체크리스트</legend>
            {INSPECTION_ITEMS.map((k) => (
              <label key={k} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border-2 border-soil-200 px-3">
                <input type="checkbox" checked={!!checked[k]} onChange={(e) => setChecked((c) => ({ ...c, [k]: e.target.checked }))} className="size-6 accent-leaf-700" />
                <span className="font-bold">{k}</span>
              </label>
            ))}
          </fieldset>
          <label className="block">
            <span className="mb-1 block font-bold">검수 의견 <span className="muted text-sm font-normal">(심의위원이 열람해요)</span></span>
            <textarea className="field min-h-24" value={opinion} onChange={(e) => setOpinion(e.target.value)} placeholder="예) 토지대장과 동의서를 확인했고 요건을 충족합니다." />
          </label>

          {error && <p role="alert" className="rounded-lg bg-red-100 p-3 font-bold text-red-700">{error}</p>}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" className="btn btn-primary" onClick={approve} disabled={!allChecked} aria-describedby="approve-hint">
              심의 상정 (위원회 안건 후보로)
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setSupplementOpen((v) => !v)} aria-expanded={supplementOpen}>
              보완 요청
            </button>
          </div>
          <p id="approve-hint" className="muted text-sm">
            {allChecked ? '심의 상정하면 “심의대기”가 돼요. 간사가 회의 안건으로 상정합니다.' : '모든 요건을 확인해야 심의 상정할 수 있어요. 부족한 요건이 있으면 보완을 요청하세요.'}
          </p>

          {supplementOpen && (
            <div className="space-y-2 rounded-xl bg-amber-100 p-3 text-amber-800">
              <label className="block">
                <span className="mb-1 block font-bold">보완 요청 사유 (제공자에게 그대로 보여요)</span>
                <textarea className="field min-h-20 text-ink" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예) 소유자 동의서에 서명이 없습니다." />
              </label>
              <button type="button" className="btn btn-primary" onClick={supplement}>
                보완 요청 보내기
              </button>
            </div>
          )}
        </section>
      ) : (
        g.inspection && (
          <Notice tone="success">
            <p className="font-bold">실무 검수 완료 ({formatDate(g.inspection.inspectedAt)})</p>
            <p>{g.inspection.opinion}</p>
          </Notice>
        )
      )}
    </div>
  );
}
