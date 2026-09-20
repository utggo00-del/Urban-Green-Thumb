import { UserPen } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Badge, Notice } from '../../components/Badge';
import { Field } from '../../components/Field';
import { DONG_CENTERS } from '../../config';
import { proxyApply } from '../../data/adminActions';
import { currentSeasonKey, getGarden, getUser, myApplication } from '../../data/selectors';
import { useDb } from '../../data/useDb';
import { PRIORITY_OPTIONS, applicableGardenIds } from '../../lib/application';
import { dDayLabel, feeLabel, formatDate } from '../../lib/date';
import { APPLICATION_STATUS } from '../../lib/labels';
import { usePageTitle } from '../../lib/usePageTitle';
import type { Application, PriorityType } from '../../types';

const OUTSIDE = '시흥시 밖(타 지역)';
const CHANNELS: NonNullable<Application['proxyChannel']>[] = ['방문', '전화', '우편'];

/** 디지털 취약 계층(고령자 등)을 위해 관리자가 시민 대신 신청을 입력한다. 자격·1인 1건·지망 규칙은 본인 신청과 같다. */
export default function Proxy() {
  usePageTitle('대리 신청 입력');
  const db = useDb();
  const season = currentSeasonKey(db);
  const max = db.settings.maxChoices;
  const openIds = useMemo(() => applicableGardenIds(db), [db]);

  const [channel, setChannel] = useState<NonNullable<Application['proxyChannel']>>('방문');
  const [mode, setMode] = useState<'existing' | 'new'>('new');
  const [query, setQuery] = useState('');
  const [userId, setUserId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [dong, setDong] = useState('');
  const [choices, setChoices] = useState<string[]>(Array.from({ length: max }, () => ''));
  const [priority, setPriority] = useState<PriorityType>('없음');
  const [verified, setVerified] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string; created: boolean } | null>(null);

  const candidates = db.users
    .filter((u) => u.role === '시민' && !myApplication(db, u.id, season))
    .filter((u) => !query.trim() || u.name.includes(query.trim()) || u.phone.replaceAll('-', '').includes(query.trim().replaceAll('-', '')))
    .slice(0, 60);
  const recent = db.applications.filter((a) => a.recruitmentSeason === season && a.appliedBy === '관리자대리' && a.status !== '취소').sort((a, b) => b.consentAt.localeCompare(a.consentAt) || b.id.localeCompare(a.id));
  const chosen = choices.filter(Boolean);

  const reset = () => {
    setUserId('');
    setName('');
    setPhone('');
    setDong('');
    setChoices(Array.from({ length: max }, () => ''));
    setPriority('없음');
    setVerified(false);
    setConsent(false);
    setQuery('');
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setDone(null);
    if (!chosen.length) return setError('1지망 텃밭을 선택해 주세요.');
    const r = proxyApply({
      userId: mode === 'existing' ? userId : undefined,
      newApplicant: mode === 'new' ? { name, phone, dong: dong === OUTSIDE ? '타 지역' : dong, isSiheungResident: !!dong && dong !== OUTSIDE } : undefined,
      choices: chosen,
      priorityType: priority,
      priorityVerified: verified,
      consentConfirmed: consent,
      channel,
    });
    if (!r.ok) return setError(r.error);
    setError(null);
    setDone({ name: getUser(db, r.value!.userId)?.name ?? name, created: r.value!.created });
    reset();
  };

  const label = (id: string) => {
    const g = getGarden(db, id)!;
    const rec = db.recruitments.find((x) => x.gardenId === id && x.status === '모집중');
    return `${g.name} · ${g.dong} · ${feeLabel(g.fee)}${rec ? ` · 마감 ${dDayLabel(rec.applyEnd, db.meta.today)}` : ''}`;
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold">
          <UserPen aria-hidden className="size-7" /> 대리 신청 입력
        </h1>
        <p className="muted">스마트폰·인터넷이 어려운 분(고령자 등)이 방문·전화·우편으로 신청하면 관리자가 대신 입력해요. ({season.replace('-', ' ')} 시즌)</p>
      </div>

      <Notice tone="info">
        <p className="text-sm">
          자격(시흥시민)과 1인 1건, 지망 최대 {max}곳 등 규칙은 본인 신청과 <strong>똑같이</strong> 적용돼요. 신청자 <strong>본인의 동의</strong>를 직접 확인해야 입력할 수 있어요. 대리 신청은 “내 신청”에 관리자 대리로 표시돼요.
        </p>
      </Notice>

      {done && (
        <Notice tone="success">
          <p className="font-bold">
            {done.name}님의 신청을 입력했어요.{done.created ? ' (신청자 정보도 새로 등록했어요)' : ''}
          </p>
          <p className="text-sm">아래 “최근 대리 신청”에서 확인할 수 있어요. 이어서 다른 분을 입력할 수 있어요.</p>
        </Notice>
      )}

      {openIds.length === 0 ? (
        <Notice tone="warn">지금은 신청할 수 있는 텃밭이 없어요. 모집이 시작되면 입력할 수 있어요.</Notice>
      ) : (
        <form onSubmit={submit} className="space-y-5" noValidate>
          <fieldset className="card space-y-3">
            <legend className="px-1 text-xl font-bold">① 접수 방식</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {CHANNELS.map((c) => (
                <label key={c} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 px-3 ${channel === c ? 'border-leaf-700 bg-leaf-50' : 'border-soil-200'}`}>
                  <input type="radio" name="channel" className="size-5 accent-leaf-700" checked={channel === c} onChange={() => setChannel(c)} />
                  <span className="font-bold">{c} 접수</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="card space-y-4">
            <legend className="px-1 text-xl font-bold">② 신청자</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ['new', '새 신청자 입력', '시스템에 없는 분'],
                  ['existing', '등록된 시민 선택', '이미 계정이 있는 분'],
                ] as const
              ).map(([v, l, hint]) => (
                <label key={v} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 px-3 ${mode === v ? 'border-leaf-700 bg-leaf-50' : 'border-soil-200'}`}>
                  <input type="radio" name="mode" className="size-5 accent-leaf-700" checked={mode === v} onChange={() => setMode(v)} />
                  <span>
                    <span className="block font-bold">{l}</span>
                    <span className="muted text-sm">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
            {mode === 'existing' ? (
              <>
                <Field label="이름 또는 연락처로 찾기">{(p) => <input {...p} className="field" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="예) 류재윤 / 1003" autoComplete="off" />}</Field>
                <Field label="신청자 선택" required hint={`이번 시즌에 아직 신청하지 않은 시민 ${candidates.length}명`}>
                  {(p) => (
                    <select {...p} className="field" value={userId} onChange={(e) => setUserId(e.target.value)}>
                      <option value="">신청자를 선택하세요</option>
                      {candidates.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} · {u.dong} · {u.phone}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              </>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="이름" required>{(p) => <input {...p} className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />}</Field>
                <Field label="연락처" required hint="예) 010-1234-5678">{(p) => <input {...p} className="field" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="off" />}</Field>
                <div className="sm:col-span-2">
                  <Field label="거주 행정동" required hint="신분증 등으로 거주지를 확인해 주세요. 시흥시 밖이면 신청할 수 없어요.">
                    {(p) => (
                      <select {...p} className="field" value={dong} onChange={(e) => setDong(e.target.value)}>
                        <option value="">행정동을 선택하세요</option>
                        {Object.keys(DONG_CENTERS).map((d) => (
                          <option key={d}>{d}</option>
                        ))}
                        <option>{OUTSIDE}</option>
                      </select>
                    )}
                  </Field>
                </div>
              </div>
            )}
          </fieldset>

          <fieldset className="card space-y-4">
            <legend className="px-1 text-xl font-bold">③ 희망 텃밭 (최대 {max}곳)</legend>
            {choices.map((value, i) => (
              <Field key={i} label={`${i + 1}지망${i === 0 ? '' : ' (선택)'}`} required={i === 0}>
                {(p) => (
                  <select {...p} className="field" value={value} onChange={(e) => setChoices((c) => c.map((x, j) => (j === i ? e.target.value : x)))}>
                    <option value="">{i === 0 ? '텃밭을 선택하세요' : '선택 안 함'}</option>
                    {openIds.filter((id) => !choices.some((c, j) => j !== i && c === id)).map((id) => (
                      <option key={id} value={id}>
                        {label(id)}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            ))}
          </fieldset>

          <fieldset className="card space-y-3">
            <legend className="px-1 text-xl font-bold">④ 우선 배정</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {PRIORITY_OPTIONS.map((o) => (
                <label key={o.value} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 px-3 ${priority === o.value ? 'border-leaf-700 bg-leaf-50' : 'border-soil-200'}`}>
                  <input type="radio" name="priority" className="size-5 accent-leaf-700" checked={priority === o.value} onChange={() => setPriority(o.value)} />
                  <span className="font-bold">{o.label}</span>
                </label>
              ))}
            </div>
            {priority !== '없음' && (
              <label className="flex min-h-12 cursor-pointer items-center gap-3">
                <input type="checkbox" className="size-5 accent-leaf-700" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
                <span>
                  <span className="font-bold">증빙을 직접 확인했어요</span>
                  <span className="muted block text-sm">확인하지 않으면 “자기신고(확인 전)”로 접수돼 우선 몫 추첨에 들어가지 않아요.</span>
                </span>
              </label>
            )}
          </fieldset>

          <fieldset className="card space-y-3 border-leaf-700">
            <legend className="px-1 text-xl font-bold">⑤ 본인 동의 확인</legend>
            <label className="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border-2 border-soil-200 p-3">
              <input type="checkbox" className="mt-1 size-6 accent-leaf-700" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span className="font-bold">신청자 본인의 개인정보 수집·이용 동의와 텃밭 이용 규칙 동의를 직접 확인했어요. (필수)</span>
            </label>
            <p className="muted text-sm">대리인이 대신 동의할 수 없어요. 방문·전화·우편 등으로 본인 의사를 확인한 뒤 체크해 주세요.</p>
          </fieldset>

          {error && (
            <p role="alert" className="rounded-lg bg-red-100 p-3 font-bold text-red-700">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary w-full sm:w-auto">
            신청 입력하기
          </button>
        </form>
      )}

      <section aria-labelledby="recent" className="space-y-3">
        <h2 id="recent" className="text-xl font-bold">
          최근 대리 신청 <span className="text-leaf-700">{recent.length}건</span>
        </h2>
        {recent.length === 0 ? (
          <div className="card muted">아직 대리 신청이 없어요.</div>
        ) : (
          <div className="card overflow-x-auto !p-0" role="region" tabIndex={0} aria-label="최근 대리 신청">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <caption className="sr-only">최근 대리 신청</caption>
              <thead>
                <tr className="border-b-2 border-soil-200">
                  {['신청자', '희망 텃밭', '접수', '우선 배정', '상태'].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.map((a) => (
                  <tr key={a.id} className="border-b border-soil-200 align-top">
                    <th scope="row" className="px-3 py-2">{getUser(db, a.userId)?.name}<span className="muted block font-normal">{getUser(db, a.userId)?.phone}</span></th>
                    <td className="px-3 py-2">{a.choices.map((c, i) => `${i + 1}지망 ${getGarden(db, c)?.name}`).join(' → ')}</td>
                    <td className="px-3 py-2">{a.proxyChannel ?? '-'} · {formatDate(a.consentAt)}</td>
                    <td className="px-3 py-2">{a.priorityType === '없음' ? '-' : `${a.priorityType} (${a.priorityVerified ? '확인 완료' : '확인 전'})`}</td>
                    <td className="px-3 py-2"><Badge tone={APPLICATION_STATUS[a.status].tone}>{APPLICATION_STATUS[a.status].label}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
