import { AlertTriangle, Check, MapPin, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AiBadge, AiLoading, AiNote, useAi } from '../../components/AiNote';
import { Badge, Notice } from '../../components/Badge';
import { DONG_CENTERS } from '../../config';
import { useDb, useSession } from '../../data/useDb';
import { CROP_GROUPS, DIFFICULTY_LABEL, type CropGroup } from '../../lib/ai/crops';
import { getAiProvider } from '../../lib/ai/provider';
import type { Experience, HelperInput, HelperResult, Transport } from '../../lib/ai/recommend';
import { usePageTitle } from '../../lib/usePageTitle';

const TRANSPORTS: { value: Transport; hint: string }[] = [
  { value: '도보', hint: '걸어서 다녀요' },
  { value: '대중교통', hint: '버스·지하철을 타요' },
  { value: '자가용', hint: '차로 다녀요' },
  { value: '휠체어·보행 보조', hint: '휠체어나 보행 보조 기구를 써요' },
];
const EXPERIENCES: { value: Experience; hint: string }[] = [
  { value: '처음이에요', hint: '텃밭 농사가 처음이에요' },
  { value: '조금 해봤어요', hint: '화분·주말농장 정도 해봤어요' },
  { value: '경험이 많아요', hint: '몇 해 동안 가꿔 왔어요' },
];

function Choice({ name, checked, onChange, label, hint, type = 'radio' }: { name: string; checked: boolean; onChange: () => void; label: string; hint?: string; type?: 'radio' | 'checkbox' }) {
  return (
    <label className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 p-3 ${checked ? 'border-leaf-700 bg-leaf-50' : 'border-soil-200'}`}>
      <input type={type} name={name} checked={checked} onChange={onChange} className="size-5 accent-leaf-700" />
      <span>
        <span className="block font-bold">{label}</span>
        {hint && <span className="muted text-sm">{hint}</span>}
      </span>
    </label>
  );
}

function Results({ result }: { result: HelperResult }) {
  return (
    <div className="space-y-6">
      {result.message && <Notice tone="warn">{result.message}</Notice>}

      <section aria-labelledby="gardens" className="space-y-3">
        <h2 id="gardens" className="text-xl font-bold">
          추천 텃밭
        </h2>
        {result.gardens.length === 0 ? (
          <div className="card muted">추천할 텃밭이 없어요.</div>
        ) : (
          <ol className="space-y-4">
            {result.gardens.map((g, i) => (
              <li key={g.gardenId} className="card space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="muted text-sm font-bold">추천 {i + 1}순위</p>
                    <h3 className="text-xl font-extrabold">{g.name}</h3>
                    <p className="muted flex items-center gap-1 text-sm">
                      <MapPin aria-hidden className="size-4" /> 집에서 직선거리 약 {g.distanceKm}km
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-extrabold text-leaf-800">
                      {g.score}
                      <span className="text-base font-bold">점</span>
                    </p>
                    <Badge tone={g.recruiting ? 'success' : 'warn'}>{g.recruiting ? '지금 신청 가능' : '모집 전'}</Badge>
                  </div>
                </div>
                {g.reasons.length > 0 && (
                  <ul className="space-y-1" aria-label="추천 이유">
                    {g.reasons.map((r) => (
                      <li key={r} className="flex items-start gap-2">
                        <Check aria-hidden className="mt-1 size-4 shrink-0 text-leaf-700" /> <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {g.cautions.length > 0 && (
                  <ul className="space-y-1" aria-label="확인할 점">
                    {g.cautions.map((c) => (
                      <li key={c} className="flex items-start gap-2 text-amber-800">
                        <AlertTriangle aria-hidden className="mt-1 size-4 shrink-0" /> <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Link to={`/gardens/${g.gardenId}`} className="btn btn-secondary">
                    텃밭 자세히 보기
                  </Link>
                  {g.recruiting && (
                    <Link to={`/apply?garden=${g.gardenId}`} className="btn btn-primary">
                      이 텃밭 포함해서 신청하기
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="crops" className="space-y-3">
        <h2 id="crops" className="text-xl font-bold">
          {result.season} 시즌 추천 작물
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {result.crops.map(({ crop, reasons }) => (
            <li key={crop.id} className="card space-y-2">
              <p className="flex flex-wrap items-center gap-2 text-lg font-extrabold">
                {crop.name} <Badge>{crop.group}</Badge> <Badge tone={crop.difficulty === 1 ? 'success' : 'neutral'}>난이도 {DIFFICULTY_LABEL[crop.difficulty]}</Badge>
              </p>
              <p className="text-sm">
                심는 시기 대략 <strong>{crop.sow}</strong> · 수확 <strong>{crop.harvest}</strong>
              </p>
              <p>{crop.tip}</p>
              <p className="muted text-sm">{reasons.join(' · ')}</p>
            </li>
          ))}
        </ul>
        <p className="muted text-sm">화학비료·합성농약 없이 가꾸는 친환경 농법이 텃밭 이용 규칙이에요. 심는 시기는 해마다 날씨에 따라 달라지니 대략적인 참고로만 봐 주세요.</p>
      </section>
    </div>
  );
}

/** 텃밭 추천 도우미 (SPEC 9-1): 거주 동·이동수단·경험·관심 작물을 입력하면 조건에 맞는 텃밭과 이번 시즌 작물을 안내한다. */
export default function Helper() {
  usePageTitle('텃밭 추천 도우미');
  const db = useDb();
  const { user } = useSession();
  const { state, run } = useAi<HelperResult>();

  const [dong, setDong] = useState(user.dong in DONG_CENTERS ? user.dong : '');
  const [transport, setTransport] = useState<Transport>('대중교통');
  const [experience, setExperience] = useState<Experience>('처음이에요');
  const [interests, setInterests] = useState<CropGroup[]>([]);
  const [freeOnly, setFreeOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!dong) return setError('사시는 행정동을 선택해 주세요.');
    setError(null);
    const input: HelperInput = { dong, transport, experience, interests, freeOnly };
    void run(() => getAiProvider().recommend(db, input));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold sm:text-3xl">
            <Sparkles aria-hidden className="size-7 text-leaf-700" /> 텃밭 추천 도우미
          </h1>
          <AiBadge />
        </div>
        <p className="muted">사시는 곳과 다니는 방법, 경험을 알려 주시면 지금 신청할 수 있는 텃밭과 이번 시즌에 심기 좋은 작물을 알려 드려요.</p>
      </div>

      <form onSubmit={submit} className="space-y-5" noValidate>
        <fieldset className="card space-y-2">
          <legend className="px-1 text-xl font-bold">① 사시는 동</legend>
          <label htmlFor="dong" className="sr-only">
            거주 행정동
          </label>
          <select id="dong" className="field" value={dong} onChange={(e) => setDong(e.target.value)} aria-invalid={!!error} aria-describedby={error ? 'dong-err' : undefined}>
            <option value="">행정동을 선택하세요</option>
            {Object.keys(DONG_CENTERS).map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          {error && (
            <p id="dong-err" role="alert" className="font-bold text-red-700">
              {error}
            </p>
          )}
        </fieldset>

        <fieldset className="card space-y-2">
          <legend className="px-1 text-xl font-bold">② 텃밭에 어떻게 다니시나요?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {TRANSPORTS.map((t) => (
              <Choice key={t.value} name="transport" checked={transport === t.value} onChange={() => setTransport(t.value)} label={t.value} hint={t.hint} />
            ))}
          </div>
        </fieldset>

        <fieldset className="card space-y-2">
          <legend className="px-1 text-xl font-bold">③ 텃밭 농사 경험</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {EXPERIENCES.map((x) => (
              <Choice key={x.value} name="experience" checked={experience === x.value} onChange={() => setExperience(x.value)} label={x.value} hint={x.hint} />
            ))}
          </div>
        </fieldset>

        <fieldset className="card space-y-2">
          <legend className="px-1 text-xl font-bold">④ 키우고 싶은 작물 (여러 개 선택 가능)</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {CROP_GROUPS.map((g) => (
              <Choice key={g} type="checkbox" name="interest" checked={interests.includes(g)} onChange={() => setInterests((c) => (c.includes(g) ? c.filter((x) => x !== g) : [...c, g]))} label={g} />
            ))}
          </div>
          <Choice type="checkbox" name="free" checked={freeOnly} onChange={() => setFreeOnly((v) => !v)} label="이용료가 없는 텃밭만 볼래요" />
        </fieldset>

        <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={state.status === 'loading'}>
          <Sparkles aria-hidden className="size-5" /> 추천 받기
        </button>
      </form>

      <div aria-live="polite" className="space-y-4">
        {state.status === 'loading' && <AiLoading text="조건에 맞는 텃밭을 찾고 있어요…" />}
        {state.status === 'error' && (
          <Notice tone="danger">
            <p className="font-bold">추천을 만들지 못했어요.</p>
            <p className="text-sm">{state.message} · 잠시 뒤 다시 시도해 주세요. 급하시면 “텃밭 찾기”에서 직접 골라 보실 수 있어요.</p>
          </Notice>
        )}
        {state.status === 'done' && (
          <>
            <Results result={state.res.data} />
            <AiNote res={state.res} />
          </>
        )}
      </div>
    </div>
  );
}
