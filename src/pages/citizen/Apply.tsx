import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Notice } from '../../components/Badge';
import { DEPARTMENT } from '../../config';
import { submitApplication } from '../../data/actions';
import { getGarden } from '../../data/selectors';
import { useDb, useSession } from '../../data/useDb';
import { PRIORITY_OPTIONS, applicableGardenIds, eligibilityBlock, existingApplication } from '../../lib/application';
import { dDayLabel, feeLabel } from '../../lib/date';
import { usePageTitle } from '../../lib/usePageTitle';
import type { PriorityType } from '../../types';

const STEPS = ['자격 확인', '희망 텃밭', '우선 배정', '확인·동의'] as const;

/**
 * 분양 신청 — 한 화면에 하나의 핵심 행동만 두는 4단계 마법사 (고령자 친화).
 * 1 자격 확인 → 2 희망 텃밭(최대 3곳 지망) → 3 우선 배정 자기신고 → 4 동의 후 제출
 */
export default function Apply() {
  usePageTitle('분양 신청');
  const db = useDb();
  const { user, today } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const eligible = eligibilityBlock(db, user);
  const existing = existingApplication(db, user.id);
  const openIds = useMemo(() => applicableGardenIds(db), [db]);
  const max = db.settings.maxChoices;

  const preselect = params.get('garden');
  const [step, setStep] = useState(0);
  const [choices, setChoices] = useState<string[]>(() => Array.from({ length: max }, (_, i) => (i === 0 && preselect && openIds.includes(preselect) ? preselect : '')));
  const [priority, setPriority] = useState<PriorityType | ''>('');
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeRules, setAgreeRules] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  // 단계가 바뀌면 제목으로 초점을 옮겨 스크린 리더와 키보드 사용자가 위치를 알 수 있게 한다
  useEffect(() => {
    heading.current?.focus();
  }, [step]);

  const chosen = choices.filter(Boolean);

  const next = () => {
    setError(null);
    if (step === 1 && !choices[0]) return setError('1지망 텃밭을 선택해 주세요.');
    if (step === 2 && !priority) return setError('해당하는 항목을 선택해 주세요. 해당이 없으면 “해당 없음”을 고르세요.');
    setStep((s) => s + 1);
  };

  const submit = () => {
    setError(null);
    setSubmitting(true);
    const result = submitApplication({ userId: user.id, choices: chosen, priorityType: priority || '없음', agreePrivacy, agreeRules });
    setSubmitting(false);
    if (!result.ok) return setError(result.error);
    navigate('/my/applications', { state: { justApplied: result.value } });
  };

  // ── 신청할 수 없는 경우 ──
  if (eligible) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="text-2xl font-extrabold">분양 신청</h1>
        <Notice tone="warn">
          <p className="font-bold">{eligible}</p>
          <p className="text-sm">현재 계정은 {user.dong} 거주로 등록되어 있습니다. (시연용 계정)</p>
        </Notice>
        <Link to="/gardens" className="btn btn-secondary">텃밭 둘러보기</Link>
      </div>
    );
  }
  if (existing) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="text-2xl font-extrabold">분양 신청</h1>
        <Notice tone="info">
          <p className="font-bold">이번 시즌에는 이미 신청하셨어요.</p>
          <p className="text-sm">한 시즌에 1인 1건만 신청할 수 있어요. 바꾸려면 내 신청에서 취소한 뒤 다시 신청해 주세요.</p>
        </Notice>
        <Link to="/my/applications" className="btn btn-primary">내 신청 보기</Link>
      </div>
    );
  }
  if (openIds.length === 0) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="text-2xl font-extrabold">분양 신청</h1>
        <Notice tone="info">지금은 신청할 수 있는 텃밭이 없어요. 모집 일정은 홈에서 확인해 주세요.</Notice>
        <Link to="/" className="btn btn-secondary">홈으로</Link>
      </div>
    );
  }

  const pct = Math.round(db.settings.priorityQuotaRatio * 100);
  const optionLabel = (id: string) => {
    const g = getGarden(db, id)!;
    const r = db.recruitments.find((x) => x.gardenId === id && x.status === '모집중');
    return `${g.name} · ${g.dong} · ${feeLabel(g.fee)}${r ? ` · 마감 ${dDayLabel(r.applyEnd, today)}` : ''}`;
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <nav aria-label="신청 단계">
        <p className="mb-2 font-bold">
          {step + 1} / {STEPS.length}단계 · {STEPS[step]}
        </p>
        <ol className="grid grid-cols-4 gap-1">
          {STEPS.map((label, i) => (
            <li
              key={label}
              aria-current={i === step ? 'step' : undefined}
              className={`rounded-lg px-1 py-2 text-center text-sm font-bold ${i === step ? 'bg-leaf-700 text-white' : i < step ? 'bg-leaf-100 text-leaf-800' : 'bg-soil-100 text-soil-700'}`}
            >
              {i < step && <Check aria-hidden className="mx-auto size-4" />}
              <span className="sr-only">{i < step ? '완료: ' : i === step ? '현재: ' : '예정: '}</span>
              {label}
            </li>
          ))}
        </ol>
      </nav>

      <div className="card space-y-5">
        {step === 0 && (
          <>
            <h1 ref={heading} tabIndex={-1} className="text-2xl font-extrabold outline-none">시흥시민 자격을 확인할게요</h1>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-leaf-50 p-3">
                <dt className="muted text-sm">신청자</dt>
                <dd className="text-lg font-extrabold">{user.name}</dd>
              </div>
              <div className="rounded-lg bg-leaf-50 p-3">
                <dt className="muted text-sm">거주 행정동</dt>
                <dd className="text-lg font-extrabold">시흥시 {user.dong}</dd>
              </div>
            </dl>
            <Notice tone="success">
              <p className="font-bold">시흥시 거주가 확인되었어요.</p>
              <p className="text-sm">시연에서는 계정 정보로 확인합니다. 실서비스에서는 본인인증·주민등록 연계로 대체됩니다.</p>
            </Notice>
            <div>
              <h2 className="mb-2 text-lg font-bold">신청 전에 알아두세요</h2>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>한 시즌에 <strong>1인 1건</strong>만 신청할 수 있어요. 같은 세대의 중복 신청은 허용되지 않아요. (안내)</li>
                <li>희망 텃밭은 <strong>최대 {max}곳</strong>까지, 순서(지망)를 정해 고릅니다.</li>
                <li>분양은 <strong>추첨</strong>으로 정합니다. 1지망을 먼저 추첨하고, 떨어지면 2지망, 3지망 순으로 진행해요.</li>
                <li>
                  다자녀·취약계층·노인은 전체 구획의 일정 비율(현재 {pct}%, 정책에 따라 조정 가능)을 먼저 추첨해요. 다만 당첨 확률을 높여 주는 가중치는 없어요.
                </li>
              </ul>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h1 ref={heading} tabIndex={-1} className="text-2xl font-extrabold outline-none">희망 텃밭을 골라 주세요</h1>
            <p className="muted">모집 중인 텃밭 {openIds.length}곳 중에서 1지망은 꼭, 2·3지망은 원하면 고르세요.</p>
            {choices.map((value, i) => {
              const taken = choices.filter((_, j) => j !== i);
              return (
                <label key={i} className="block">
                  <span className="mb-1 block text-lg font-bold">
                    {i + 1}지망 {i === 0 ? <span className="text-clay-700">(필수)</span> : <span className="muted font-normal">(선택)</span>}
                  </span>
                  <select
                    className="field"
                    value={value}
                    onChange={(e) => setChoices((c) => c.map((x, j) => (j === i ? e.target.value : x)))}
                    aria-invalid={i === 0 && !!error && !value}
                  >
                    <option value="">{i === 0 ? '텃밭을 선택하세요' : '선택 안 함'}</option>
                    {openIds
                      .filter((id) => !taken.includes(id))
                      .map((id) => (
                        <option key={id} value={id}>
                          {optionLabel(id)}
                        </option>
                      ))}
                  </select>
                </label>
              );
            })}
            {chosen.length > 0 && (
              <p className="muted text-sm">
                고른 텃밭:{' '}
                {chosen.map((id, i) => (
                  <span key={id}>
                    {i > 0 && ' → '}
                    {i + 1}지망 {getGarden(db, id)?.name}
                  </span>
                ))}
              </p>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <h1 ref={heading} tabIndex={-1} className="text-2xl font-extrabold outline-none">우선 배정 대상이신가요?</h1>
            <p className="muted">스스로 선택(자기신고)하시면 되고, 담당 부서가 나중에 확인해요. 해당이 없어도 불이익은 없어요.</p>
            <fieldset className="space-y-2">
              <legend className="sr-only">우선 배정 대상 선택</legend>
              {PRIORITY_OPTIONS.map((o) => (
                <label key={o.value} className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border-2 p-3 ${priority === o.value ? 'border-leaf-700 bg-leaf-50' : 'border-soil-200'}`}>
                  <input type="radio" name="priority" value={o.value} checked={priority === o.value} onChange={() => setPriority(o.value)} className="mt-1 size-5 accent-leaf-700" />
                  <span>
                    <span className="block text-lg font-bold">{o.label}</span>
                    <span className="muted text-sm">{o.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          </>
        )}

        {step === 3 && (
          <>
            <h1 ref={heading} tabIndex={-1} className="text-2xl font-extrabold outline-none">내용을 확인하고 동의해 주세요</h1>
            <dl className="divide-y divide-soil-200 rounded-xl border border-soil-200">
              <div className="grid gap-1 p-3 sm:grid-cols-[8rem_1fr]">
                <dt className="muted">신청자</dt>
                <dd className="font-bold">{user.name} ({user.dong})</dd>
              </div>
              {chosen.map((id, i) => (
                <div key={id} className="grid gap-1 p-3 sm:grid-cols-[8rem_1fr]">
                  <dt className="muted">{i + 1}지망</dt>
                  <dd className="font-bold">{getGarden(db, id)?.name}</dd>
                </div>
              ))}
              <div className="grid gap-1 p-3 sm:grid-cols-[8rem_1fr]">
                <dt className="muted">우선 배정</dt>
                <dd className="font-bold">{priority === '없음' ? '해당 없음' : `${priority} (자기신고, 확인 전)`}</dd>
              </div>
            </dl>

            <div className="space-y-3">
              <div className="rounded-xl bg-soil-100 p-3 text-sm">
                <p className="font-bold">개인정보 수집·이용 안내 (예시 문구)</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  <li>수집 항목(최소): 이름, 거주 행정동, 연락처, 우선 배정 자기신고 여부</li>
                  <li>이용 목적: 텃밭 분양 추첨과 안내, 이용 관리</li>
                  <li>보유 기간: 해당 시즌 종료 후 1년 (예시)</li>
                  <li>책임 부서: {DEPARTMENT}</li>
                </ul>
              </div>
              <label className="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border-2 border-soil-200 p-3">
                <input type="checkbox" checked={agreePrivacy} onChange={(e) => setAgreePrivacy(e.target.checked)} className="mt-1 size-6 accent-leaf-700" />
                <span className="font-bold">개인정보 수집·이용에 동의합니다. (필수)</span>
              </label>
              <label className="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border-2 border-soil-200 p-3">
                <input type="checkbox" checked={agreeRules} onChange={(e) => setAgreeRules(e.target.checked)} className="mt-1 size-6 accent-leaf-700" />
                <span>
                  <span className="font-bold">텃밭 이용 규칙에 동의합니다. (필수)</span>
                  <span className="muted block text-sm">유기농 원칙, 구획 밖 사용 금지, 잡초·병해충 방치 금지, 미경작 경고 3회 누적 시 회수 등</span>
                </span>
              </label>
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-red-100 p-3 font-bold text-red-700">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          {step > 0 ? (
            <button type="button" className="btn btn-secondary" onClick={() => { setError(null); setStep((s) => s - 1); }}>
              <ArrowLeft aria-hidden className="size-5" /> 이전
            </button>
          ) : (
            <Link to="/gardens" className="btn btn-secondary">
              <ArrowLeft aria-hidden className="size-5" /> 텃밭 찾기로
            </Link>
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn btn-primary" onClick={next}>
              다음 <ArrowRight aria-hidden className="size-5" />
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={submit} disabled={!agreePrivacy || !agreeRules || submitting}>
              신청서 제출하기
            </button>
          )}
        </div>
        {step === STEPS.length - 1 && (!agreePrivacy || !agreeRules) && <p className="muted text-sm">두 가지 동의에 모두 체크하면 제출할 수 있어요.</p>}
      </div>
    </div>
  );
}
