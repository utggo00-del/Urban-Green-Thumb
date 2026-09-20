import { FileCheck2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { DONG_CENTERS, FACILITY_LABELS, SAMPLE_DOCS } from '../config';
import { migrateGarden, registerGarden } from '../data/workflowActions';
import { useDb } from '../data/useDb';
import { hasErrors, validateRegistration, type FieldErrors, type RegistrationInput } from '../lib/registration';
import type { FacilityKey, MeetingKind, OrdinanceType, OwnerKind, User } from '../types';
import { Notice } from './Badge';
import { FileAttach } from './DocList';
import { Field } from './Field';

const ORDINANCE_TYPES: OrdinanceType[] = ['도시텃밭', '상자텃밭', '학습·생태체험텃밭'];
const CITY_OWNER_ID = 'u_o_city';

interface Props {
  /** register: 등록 신청 / migrate: 기존 지정 텃밭 이관 입력(간사) */
  mode: 'register' | 'migrate';
  /** 선택할 수 있는 텃밭 유형. 제공자는 개인·민간, 관리자는 공공 포함 */
  typeOptions: OwnerKind[];
  /** 소유자 후보. 하나면 고정 표시 */
  owners: User[];
  onDone: (gardenId: string) => void;
}

function Section({ title, children, hint }: { title: string; children: ReactNode; hint?: string }) {
  return (
    <fieldset className="card space-y-4">
      <legend className="px-1 text-xl font-bold">{title}</legend>
      {hint && <p className="muted -mt-2 text-sm">{hint}</p>}
      {children}
    </fieldset>
  );
}

const num = (s: string) => (s.trim() === '' ? NaN : Number(s.replaceAll(',', '')));

export function RegistrationForm({ mode, typeOptions, owners, onDone }: Props) {
  const db = useDb();
  const [type, setType] = useState<OwnerKind>(typeOptions[0]);
  const [ownerId, setOwnerId] = useState(owners[0]?.id ?? '');
  const [ordinanceType, setOrdinanceType] = useState<OrdinanceType>('도시텃밭');
  const [weekend, setWeekend] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [dong, setDong] = useState('');
  const [plotCount, setPlotCount] = useState('');
  const [plotAreaM2, setPlotAreaM2] = useState('');
  const [totalAreaM2, setTotalAreaM2] = useState('');
  const [seasonMinTerm, setSeasonMinTerm] = useState('12');
  const [facilities, setFacilities] = useState<FacilityKey[]>([]);
  const [rules, setRules] = useState('');
  const [fee, setFee] = useState('');
  const [bank, setBank] = useState('');
  const [acctNo, setAcctNo] = useState('');
  const [holder, setHolder] = useState('');
  const [documents, setDocuments] = useState<string[]>([]);
  const [consent, setConsent] = useState<string[]>([]);
  // 이관 입력 전용
  const [meetingKind, setMeetingKind] = useState<MeetingKind>('정례');
  const [round, setRound] = useState('1');
  const [decidedAt, setDecidedAt] = useState('');

  const [errors, setErrors] = useState<FieldErrors>({});
  const [extraError, setExtraError] = useState<string | null>(null);
  const summary = useRef<HTMLDivElement>(null);

  const isPublic = type === '공공';
  const ownerList = isPublic ? owners.filter((o) => o.id === CITY_OWNER_ID) : owners.filter((o) => o.id !== CITY_OWNER_ID);
  const owner = ownerList.find((o) => o.id === ownerId) ?? ownerList[0];
  const needAccount = !isPublic && num(fee) > 0;

  // 유형을 바꾸면 소유자를 맞춰 준다 (공공 = 시 소유)
  useEffect(() => {
    if (owner && owner.id !== ownerId) setOwnerId(owner.id);
  }, [owner, ownerId]);

  const errorList = [...Object.values(errors), ...(extraError ? [extraError] : [])];
  useEffect(() => {
    if (errorList.length) summary.current?.focus();
    // 제출할 때마다 오류 요약으로 초점을 옮긴다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errors, extraError]);

  const toInput = (): RegistrationInput => ({
    ownerId: owner?.id ?? '',
    type,
    ordinanceType,
    name,
    address,
    dong,
    totalAreaM2: num(totalAreaM2),
    plotCount: num(plotCount),
    plotAreaM2: num(plotAreaM2),
    facilities,
    rules,
    fee: num(fee === '' ? '0' : fee),
    feeAccount: needAccount ? { bank, number: acctNo, holder } : undefined,
    isWeekendFarmOperator: type === '민간' ? weekend : undefined,
    seasonMinTerm: num(seasonMinTerm),
    documents,
    ownerConsentDoc: consent[0] ?? '',
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setExtraError(null);
    const input = toInput();
    const errs = validateRegistration(input);
    setErrors(errs);
    if (hasErrors(errs)) return;
    const result =
      mode === 'migrate'
        ? migrateGarden({ garden: input, meetingKind, round: num(round), decidedAt })
        : registerGarden(input);
    if (!result.ok) return setExtraError(result.error);
    onDone(result.value);
  };

  const fillSample = () => {
    setDocuments([...SAMPLE_DOCS.land]);
    setConsent([SAMPLE_DOCS.consent]);
  };

  const toggleFacility = (k: FacilityKey) => setFacilities((f) => (f.includes(k) ? f.filter((x) => x !== k) : [...f, k]));

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {errorList.length > 0 && (
        <div ref={summary} tabIndex={-1} role="alert" className="rounded-xl bg-red-100 p-4 text-red-700 outline-none">
          <p className="font-extrabold">입력을 확인해 주세요 ({errorList.length}건)</p>
          <ul className="mt-1 list-disc pl-5">
            {errorList.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      <Section title="① 소유자와 텃밭 종류">
        <Field label="소유자">
          {(p) =>
            ownerList.length > 1 ? (
              <select {...p} className="field" value={owner?.id} onChange={(e) => setOwnerId(e.target.value)}>
                {ownerList.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            ) : (
              <input {...p} className="field bg-soil-100" value={`${owner?.name ?? ''}${isPublic ? '' : ` · ${owner?.phone ?? ''}`}`} readOnly />
            )
          }
        </Field>
        <p className="muted -mt-2 text-sm">소유자 이름과 연락처는 시민에게 공개되지 않아요.</p>

        {typeOptions.length > 1 && (
          <Field label="텃밭 유형" required>
            {(p) => (
              <select
                {...p}
                className="field"
                value={type}
                onChange={(e) => {
                  const t = e.target.value as OwnerKind;
                  setType(t);
                  if (t === '공공' && fee === '') setFee(String(db.settings.publicGardenFee));
                }}
              >
                {typeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t} 텃밭
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}

        <Field label="조례상 유형" required hint="도시텃밭 · 상자텃밭 · 학습·생태체험텃밭 중에서 선택해요. (조례 제2조)">
          {(p) => (
            <select {...p} className="field" value={ordinanceType} onChange={(e) => setOrdinanceType(e.target.value as OrdinanceType)}>
              {ORDINANCE_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          )}
        </Field>

        {type === '민간' && (
          <label className="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border-2 border-soil-200 p-3">
            <input type="checkbox" checked={weekend} onChange={(e) => setWeekend(e.target.checked)} className="mt-1 size-6 accent-leaf-700" />
            <span>
              <span className="font-bold">주말농원사업자(도시텃밭운영자)입니다</span>
              <span className="muted block text-sm">농어촌정비법에 따른 사업자 여부이며, 프로토타입에서는 입력받아 표시만 해요.</span>
            </span>
          </label>
        )}
      </Section>

      <Section title="② 위치와 규모">
        <Field label="텃밭 이름" required error={errors.name} hint="실제 시설로 오인되지 않는 이름을 써 주세요.">
          {(p) => <input {...p} className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />}
        </Field>
        <Field label="주소" required error={errors.address}>
          {(p) => <input {...p} className="field" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="예) 경기도 시흥시 정왕동 123-4" autoComplete="off" />}
        </Field>
        <Field label="행정동" required error={errors.dong} hint="지도에는 이 행정동 근처에 표시돼요. (실서비스에서는 지도에서 위치를 직접 지정)">
          {(p) => (
            <select {...p} className="field" value={dong} onChange={(e) => setDong(e.target.value)}>
              <option value="">행정동을 선택하세요</option>
              {Object.keys(DONG_CENTERS).map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="구획 수 (개)" required error={errors.plotCount}>
            {(p) => <input {...p} className="field" inputMode="numeric" value={plotCount} onChange={(e) => setPlotCount(e.target.value)} placeholder="예) 12" />}
          </Field>
          <Field label="구획 1개 면적 (㎡)" required error={errors.plotAreaM2} hint="3~5평은 약 10~16㎡예요.">
            {(p) => <input {...p} className="field" inputMode="decimal" value={plotAreaM2} onChange={(e) => setPlotAreaM2(e.target.value)} placeholder="예) 13" />}
          </Field>
          <Field label="전체 면적 (㎡)" required error={errors.totalAreaM2} hint="통로 등을 포함한 텃밭 전체 면적이에요.">
            {(p) => <input {...p} className="field" inputMode="decimal" value={totalAreaM2} onChange={(e) => setTotalAreaM2(e.target.value)} placeholder="예) 250" />}
          </Field>
          <Field label="최소 제공 기간 (개월)" required error={errors.seasonMinTerm} hint="이 기간 이상 텃밭으로 제공해 주셔야 해요.">
            {(p) => <input {...p} className="field" inputMode="numeric" value={seasonMinTerm} onChange={(e) => setSeasonMinTerm(e.target.value)} />}
          </Field>
        </div>
      </Section>

      <Section title="③ 시설과 이용 규칙">
        <fieldset>
          <legend className="mb-1 font-bold">있는 시설을 모두 선택하세요</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(FACILITY_LABELS) as FacilityKey[]).map((k) => (
              <label key={k} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border-2 border-soil-200 px-3">
                <input type="checkbox" checked={facilities.includes(k)} onChange={() => toggleFacility(k)} className="size-5 accent-leaf-700" />
                <span className="font-bold">{FACILITY_LABELS[k]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="이용 규칙" hint="비워 두면 기본 규칙(유기농 원칙, 구획 밖 사용 금지 등)이 적용돼요.">
          {(p) => <textarea {...p} className="field min-h-28" value={rules} onChange={(e) => setRules(e.target.value)} />}
        </Field>
      </Section>

      <Section title="④ 이용료">
        <Field
          label="이용료 (원/시즌)"
          error={errors.fee}
          hint={isPublic ? '공공 텃밭은 시 기준 금액(시연용 가상 금액)을 입력해요. 무료는 0.' : '무료면 0을 입력하세요. 이용료는 당첨자가 소유자 계좌로 직접 송금하며, 시는 결제에 관여하지 않아요.'}
        >
          {(p) => <input {...p} className="field" inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="예) 30000" />}
        </Field>
        {needAccount && (
          <div className="space-y-4" role="group" aria-label="이용료 받을 계좌">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="은행" required>
                {(p) => <input {...p} className="field" value={bank} onChange={(e) => setBank(e.target.value)} placeholder="가상은행" />}
              </Field>
              <Field label="계좌번호" required>
                {(p) => <input {...p} className="field" inputMode="numeric" value={acctNo} onChange={(e) => setAcctNo(e.target.value)} placeholder="000-00-000000" />}
              </Field>
              <Field label="예금주" required>
                {(p) => <input {...p} className="field" value={holder} onChange={(e) => setHolder(e.target.value)} />}
              </Field>
            </div>
            {errors.feeAccount && (
              <p role="alert" className="font-bold text-red-700">
                {errors.feeAccount}
              </p>
            )}
            <Notice tone="info">계좌는 당첨이 확정된 사람에게만 “내 텃밭”에서 안내돼요. 시연에서는 가상 계좌만 입력해 주세요.</Notice>
          </div>
        )}
      </Section>

      <Section title="⑤ 서류 첨부" hint="프로토타입은 파일 내용을 저장하지 않고 파일명만 기록해요.">
        <div>
          <p className="mb-1 font-bold">
            토지 서류 <span className="text-clay-700" aria-label="필수">*</span> <span className="muted text-sm font-normal">(토지대장, 토지이용계획확인서 등)</span>
          </p>
          <FileAttach id="docs" label="토지 서류 선택" multiple files={documents} onChange={setDocuments} error={errors.documents} />
          {errors.documents && (
            <p role="alert" className="mt-1 font-bold text-red-700">
              {errors.documents}
            </p>
          )}
        </div>
        <div>
          <p className="mb-1 font-bold">
            소유자 동의서 <span className="text-clay-700" aria-label="필수">*</span> <span className="muted text-sm font-normal">(조례 제11조, 필수)</span>
          </p>
          <FileAttach id="consent" label="소유자 동의서 선택" files={consent} onChange={setConsent} error={errors.ownerConsentDoc} />
          {errors.ownerConsentDoc && (
            <p role="alert" className="mt-1 font-bold text-red-700">
              {errors.ownerConsentDoc}
            </p>
          )}
        </div>
        <button type="button" className="btn btn-secondary w-full sm:w-auto" onClick={fillSample}>
          <FileCheck2 aria-hidden className="size-5" /> 시연용 샘플 서류 첨부
        </button>
      </Section>

      {mode === 'migrate' && (
        <Section title="⑥ 위원회 심의 이력" hint="이미 심의를 거쳐 조성된 텃밭이므로 심의 회차와 일자를 직접 입력해 ‘지정’ 상태로 등록해요.">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="회의 종류" required>
              {(p) => (
                <select {...p} className="field" value={meetingKind} onChange={(e) => setMeetingKind(e.target.value as MeetingKind)}>
                  <option>정례</option>
                  <option>임시</option>
                </select>
              )}
            </Field>
            <Field label="회차 (그 해의 제○회)" required hint="회차는 연도별로 세요.">
              {(p) => <input {...p} className="field" inputMode="numeric" value={round} onChange={(e) => setRound(e.target.value)} />}
            </Field>
            <Field label="심의(의결) 일자" required>
              {(p) => <input {...p} type="date" className="field" value={decidedAt} max={db.meta.today} onChange={(e) => setDecidedAt(e.target.value)} />}
            </Field>
          </div>
        </Section>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="submit" className="btn btn-primary w-full sm:w-auto">
          {mode === 'migrate' ? '지정 텃밭으로 이관 등록' : '등록 신청하기'}
        </button>
      </div>
    </form>
  );
}
