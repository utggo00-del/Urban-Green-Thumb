import { Accessibility, ArrowLeft, Car, Check, Droplets, MessageCircle, ShieldCheck, Toilet, Warehouse, X, type LucideIcon } from 'lucide-react';
import { Suspense, lazy, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge, KindBadge, Notice } from '../../components/Badge';
import { GardenCardSkeleton } from '../../components/GardenCard';
import { FACILITY_LABELS } from '../../config';
import { getGarden, isPublished } from '../../data/selectors';
import { useDb, useSession } from '../../data/useDb';
import { eligibilityBlock, existingApplication, gardenApplyBlock } from '../../lib/application';
import { dDayLabel, feeLabel, formatDate } from '../../lib/date';
import { toGardenView, toPyeong } from '../../lib/gardens';
import { RECRUITMENT_STATUS } from '../../lib/labels';
import { designationLabel } from '../../lib/meeting';
import { usePageTitle } from '../../lib/usePageTitle';
import type { FacilityKey } from '../../types';

const GardenMap = lazy(() => import('../../components/GardenMap'));

const FACILITY_ICONS: Record<FacilityKey, LucideIcon> = {
  water: Droplets,
  toolShed: Warehouse,
  parking: Car,
  restroom: Toilet,
  wheelchair: Accessibility,
};

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="card space-y-3">
      <h2 id={id} className="text-xl font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** 소유자 이름·연락처는 비공개이므로, 문의는 앱 내 문의(모의)로만 연결한다. (SPEC 5.6) */
function InquiryBox({ gardenName }: { gardenName: string }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [text, setText] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSent(true); // 프로토타입: 저장·전송하지 않는다. 실서비스에서는 텃밭지원과를 거쳐 제공자에게 전달.
  };

  if (sent) {
    return (
      <Notice tone="success">
        <p className="font-bold">문의가 접수되었어요. (시연)</p>
        <p className="text-sm">실서비스에서는 소유자 연락처를 공개하지 않고 앱을 통해 답변이 전달됩니다.</p>
      </Notice>
    );
  }
  return open ? (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="mb-1 block font-bold">{gardenName}에 대한 문의 내용</span>
        <textarea className="field min-h-28" value={text} onChange={(e) => setText(e.target.value)} placeholder="예) 주차 가능한 대수가 궁금해요." required />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary">문의 보내기</button>
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>닫기</button>
      </div>
    </form>
  ) : (
    <button type="button" className="btn btn-secondary w-full sm:w-auto" onClick={() => setOpen(true)}>
      <MessageCircle aria-hidden className="size-5" /> 앱 내 문의하기
    </button>
  );
}

export default function GardenDetail() {
  const { id = '' } = useParams();
  const db = useDb();
  const { user, today } = useSession();
  const garden = getGarden(db, id);
  const published = !!garden && isPublished(garden);
  usePageTitle(published ? garden!.name : '텃밭을 찾을 수 없어요');
  const view = useMemo(() => (published ? toGardenView(db, garden!) : null), [db, garden, published]);

  // 위원회 심의를 거치지 않은 텃밭은 주소로 직접 들어와도 보여주지 않는다. 존재 여부도 알리지 않는다.
  if (!garden || !view) {
    return (
      <div className="mx-auto max-w-xl space-y-4 text-center">
        <h1 className="text-2xl font-extrabold">텃밭을 찾을 수 없어요</h1>
        <p className="muted">없는 텃밭이거나 아직 공개되지 않은 텃밭입니다. 위원회 심의를 거쳐 지정된 텃밭만 볼 수 있어요.</p>
        <Link to="/gardens" className="btn btn-primary">
          텃밭 찾기로 돌아가기
        </Link>
      </div>
    );
  }

  const r = view.recruitment;
  const blockReason = eligibilityBlock(db, user) ?? (existingApplication(db, user.id) ? '이번 시즌에는 이미 신청하셨어요. (1인 1건)' : null) ?? gardenApplyBlock(db, garden.id);
  const alreadyApplied = !!existingApplication(db, user.id);
  const d = garden.designation;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to="/gardens" className="inline-flex min-h-12 items-center gap-1 font-bold">
        <ArrowLeft aria-hidden className="size-5" /> 텃밭 찾기
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <KindBadge kind={garden.type} />
          <Badge>{garden.ordinanceType}</Badge>
          {garden.type === '민간' && <Badge tone={garden.isWeekendFarmOperator ? 'success' : 'neutral'}>{garden.isWeekendFarmOperator ? '주말농원사업자(도시텃밭운영자)' : '주말농원사업자 아님'}</Badge>}
        </div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">{garden.name}</h1>
        <p className="muted">{garden.address}</p>
        {d && (
          <div className="rounded-xl bg-leaf-100 p-3 text-leaf-800">
            <p className="flex items-start gap-2 font-bold">
              <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0" />
              <span>위원회 심의 완료 · {designationLabel(d)}</span>
            </p>
            <p className="mt-1 text-sm">
              조례 제11조에 따라 도시농업위원회 심의를 거쳐 지정되었습니다.{d.migrated ? ' (기존 조성 텃밭 이관 등록)' : ''}
            </p>
          </div>
        )}
      </header>

      {/* 신청 */}
      <section aria-labelledby="apply" className="card space-y-3 border-leaf-700 bg-leaf-50">
        <h2 id="apply" className="text-xl font-bold">
          분양 신청
        </h2>
        {blockReason ? (
          <>
            <button type="button" className="btn btn-primary w-full sm:w-auto" disabled aria-disabled="true" aria-describedby="apply-why">
              신청할 수 없어요
            </button>
            <p id="apply-why" className="font-bold text-clay-700">
              {blockReason}
            </p>
            {alreadyApplied && (
              <Link to="/my/applications" className="btn btn-secondary w-full sm:w-auto">
                내 신청 보기
              </Link>
            )}
          </>
        ) : (
          <>
            <Link to={`/apply?garden=${garden.id}`} className="btn btn-primary w-full sm:w-auto">
              이 텃밭 포함해서 신청하기
            </Link>
            <p className="muted text-sm">희망 텃밭은 최대 3곳까지 순서를 정해 한 번에 신청해요. 분양은 추첨으로 정해집니다.</p>
          </>
        )}
      </section>

      <Section id="loc" title="위치">
        <Suspense fallback={<GardenCardSkeleton />}>
          <GardenMap items={[view]} zoomToSingle className="h-64 sm:h-80" label={`${garden.name} 위치 지도`} />
        </Suspense>
        <p>
          {garden.address} · <strong>{garden.dong}</strong>
        </p>
        <p className="muted text-sm">소유자 이름과 연락처는 공개되지 않아요. 궁금한 점은 앱 내 문의로 남겨 주세요.</p>
        <InquiryBox gardenName={garden.name} />
      </Section>

      <Section id="plots" title="구획 정보">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['전체 구획', `${garden.plotCount}개`],
            ['잔여 구획', `${view.vacant}개`],
            ['구획 1개 면적', `${garden.plotAreaM2}㎡ (약 ${toPyeong(garden.plotAreaM2)}평)`],
            ['전체 면적', `${garden.totalAreaM2.toLocaleString('ko-KR')}㎡`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-leaf-50 p-3">
              <dt className="muted text-sm">{k}</dt>
              <dd className="font-extrabold">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="facilities" title="시설">
        <ul className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(FACILITY_LABELS) as FacilityKey[]).map((k) => {
            const Icon = FACILITY_ICONS[k];
            const has = garden.facilities.includes(k);
            return (
              <li key={k} className="flex items-center gap-3 rounded-lg border border-soil-200 p-3">
                <Icon aria-hidden className="size-6 shrink-0 text-leaf-700" />
                <span className="flex-1 font-bold">{FACILITY_LABELS[k]}</span>
                <span className={`inline-flex items-center gap-1 font-bold ${has ? 'text-leaf-800' : 'text-soil-600'}`}>
                  {has ? <Check aria-hidden className="size-4" /> : <X aria-hidden className="size-4" />}
                  {has ? '있음' : '없음'}
                </span>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section id="rules" title="이용 규칙">
        <p>{garden.rules}</p>
      </Section>

      <Section id="fee" title="이용료">
        <p className="text-2xl font-extrabold">{feeLabel(garden.fee)}</p>
        {garden.type === '공공' ? (
          <p className="muted">공공 텃밭의 이용료는 시 기준 금액(시연용 가상 금액)입니다.</p>
        ) : (
          <>
            <p>
              이용료는 <strong>당첨 확정 후</strong> 텃밭 제공자가 등록한 계좌로 직접 송금합니다.
            </p>
            <p className="muted text-sm">송금 계좌는 당첨 후 “내 텃밭”에서만 안내됩니다. 이용료는 제공자에게 직접 송금하며 시는 결제에 관여하지 않습니다.</p>
          </>
        )}
        <p className="muted text-sm">최소 제공 기간 {garden.seasonMinTerm}개월</p>
      </Section>

      <Section id="schedule" title="모집 일정">
        {r ? (
          <>
            <Badge tone={RECRUITMENT_STATUS[r.status].tone}>{RECRUITMENT_STATUS[r.status].label}</Badge>
            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                ['시즌', `${r.year}년 ${r.season}`],
                ['모집 구획', `${r.plotsOffered}개 (지망 신청 ${view.applicants}명)`],
                ['신청 기간', `${formatDate(r.applyStart)} ~ ${formatDate(r.applyEnd)}${r.status === '모집중' ? ` (${dDayLabel(r.applyEnd, today)})` : ''}`],
                ['추첨일', formatDate(r.drawDate)],
                ['당첨 후 수락 기한', `${r.acceptDeadlineDays}일`],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="muted text-sm">{k}</dt>
                  <dd className="font-bold">{v}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <p className="muted">이번 시즌에는 모집하지 않아요. 다음 모집은 홈의 “모집 일정”에서 확인하세요.</p>
        )}
      </Section>
    </div>
  );
}
