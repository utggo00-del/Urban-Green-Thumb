import { CalendarRange, Check, Copy, Megaphone, ShieldAlert, Sprout } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, KindBadge, Notice } from '../../components/Badge';
import { getGarden, noticesFor } from '../../data/selectors';
import { useDb, useSession } from '../../data/useDb';
import { dDayLabel, feeLabel, formatDate, formatKRW } from '../../lib/date';
import { toPyeong } from '../../lib/gardens';
import { usePageTitle } from '../../lib/usePageTitle';
import { reasonHasDate, usedPlots, warningLevel, warningsOf } from '../../lib/warnings';
import type { Garden, Plot } from '../../types';

/** 경고 횟수를 칸으로 보여준다. 색만이 아니라 채워진 칸 수와 글자(“2회 / 3회”)를 함께 쓴다. */
function WarningMeter({ count, limit }: { count: number; limit: number }) {
  return (
    <div className="flex items-center gap-3" role="img" aria-label={`경고 ${count}회, ${limit}회 누적 시 회수`}>
      <div className="flex gap-1.5" aria-hidden>
        {Array.from({ length: limit }, (_, i) => (
          <span key={i} className={`grid size-9 place-items-center rounded-lg border-2 font-extrabold ${i < count ? (count >= limit - 1 ? 'border-red-700 bg-red-100 text-red-700' : 'border-amber-800 bg-amber-100 text-amber-800') : 'border-soil-200 bg-paper text-soil-600'}`}>
            {i < count ? '!' : i + 1}
          </span>
        ))}
      </div>
      <p className="font-bold">
        경고 {count}회 <span className="muted font-normal">/ {limit}회 누적 시 회수</span>
      </p>
    </div>
  );
}

/**
 * 이용료 안내. 공공 텃밭은 시 기준 금액(가상)만 표시하고,
 * 민간·개인 텃밭은 당첨을 수락한 이용자에게만 제공자의 등록 계좌를 보여준다. 결제·정산 기능은 없다.
 */
function FeeGuide({ garden }: { garden: Garden }) {
  const [copied, setCopied] = useState(false);
  const acct = garden.feeAccount;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(acct!.number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  if (garden.type === '공공') {
    return (
      <div className="space-y-1">
        <p className="text-xl font-extrabold">{feeLabel(garden.fee)}</p>
        <p className="muted text-sm">공공 텃밭의 이용료는 시 기준 금액(시연용 가상 금액)이에요. 납부 방법은 텃밭지원과 안내를 따라 주세요.</p>
      </div>
    );
  }
  if (garden.fee === 0 || !acct) {
    return (
      <div className="space-y-1">
        <p className="text-xl font-extrabold">무료</p>
        <p className="muted text-sm">이 텃밭은 이용료가 없어요.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-xl font-extrabold">{feeLabel(garden.fee)}</p>
      <dl className="grid gap-2 rounded-xl bg-leaf-50 p-3 sm:grid-cols-3">
        <div>
          <dt className="muted text-sm">은행</dt>
          <dd className="font-bold">{acct.bank}</dd>
        </div>
        <div>
          <dt className="muted text-sm">계좌번호 (가상)</dt>
          <dd className="font-mono font-bold">{acct.number}</dd>
        </div>
        <div>
          <dt className="muted text-sm">예금주 (제공자)</dt>
          <dd className="font-bold">{acct.holder}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-secondary !min-h-11" onClick={copy}>
          {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />} 계좌번호 복사
        </button>
        <span role="status" className="font-bold text-leaf-800">
          {copied ? '복사했어요' : ''}
        </span>
      </div>
      <Notice tone="info">
        <p className="font-bold">이용료는 제공자에게 직접 송금하며 시는 결제에 관여하지 않습니다.</p>
        <p className="text-sm">위 {formatKRW(garden.fee)}을(를) 제공자 계좌로 보내 주세요. 송금 확인과 영수증은 제공자와 직접 해결해야 해요. 이 앱은 금액과 계좌를 안내만 합니다.</p>
      </Notice>
    </div>
  );
}

function PlotCard({ plot }: { plot: Plot }) {
  const db = useDb();
  const { today } = useSession();
  const garden = getGarden(db, plot.gardenId)!;
  const limit = db.settings.warningLimit;
  const list = warningsOf(db, plot.id, plot.userId);
  const level = warningLevel(list.length, limit);
  const recall = plot.status === '회수대기';

  return (
    <article className="card space-y-5" aria-label={`${garden.name} ${plot.number}번 구획`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-extrabold">{garden.name}</h2>
          <p className="flex flex-wrap items-center gap-2">
            <KindBadge kind={garden.type} /> <Badge>{garden.ordinanceType}</Badge>
          </p>
        </div>
        {recall ? <Badge tone="danger">회수 대상</Badge> : <Badge tone="success">이용중</Badge>}
      </div>

      {level === 'recall' && (
        <Notice tone="danger">
          <p className="font-bold">경고 {list.length}회가 쌓여 이 구획이 회수 대상이 되었어요.</p>
          <p className="text-sm">담당 부서(텃밭지원과)가 확인한 뒤 회수를 확정해요. 문의는 텃밭지원과로 해 주세요.</p>
        </Notice>
      )}
      {level === 'danger' && (
        <Notice tone="danger">
          <p className="font-bold">경고 {list.length}회 — 한 번 더 경고를 받으면 구획이 회수돼요.</p>
          <p className="text-sm">아래 사유를 확인하고 텃밭을 다시 가꿔 주세요.</p>
        </Notice>
      )}
      {level === 'notice' && (
        <Notice tone="warn">
          <p className="font-bold">미경작 경고가 {list.length}회 있어요. ({limit}회 누적 시 회수)</p>
        </Notice>
      )}

      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-leaf-50 p-3">
          <dt className="muted text-sm">내 구획</dt>
          <dd className="text-2xl font-extrabold">{plot.number}번</dd>
          <dd className="muted text-sm">
            {garden.plotAreaM2}㎡ (약 {toPyeong(garden.plotAreaM2)}평)
          </dd>
        </div>
        <div className="rounded-lg bg-leaf-50 p-3 sm:col-span-2">
          <dt className="muted flex items-center gap-1 text-sm">
            <CalendarRange aria-hidden className="size-4" /> 이용 기간
          </dt>
          {plot.usageStart && plot.usageEnd ? (
            <>
              <dd className="text-lg font-extrabold">
                {formatDate(plot.usageStart)} ~ {formatDate(plot.usageEnd)}
              </dd>
              <dd className="muted text-sm">이용 종료까지 {dDayLabel(plot.usageEnd, today)}</dd>
            </>
          ) : (
            <dd className="font-bold">-</dd>
          )}
        </div>
      </dl>

      <section aria-label="경고 이력" className="space-y-2">
        <h3 className="flex items-center gap-2 text-lg font-bold">
          <ShieldAlert aria-hidden className="size-5" /> 경고 이력
        </h3>
        <WarningMeter count={list.length} limit={limit} />
        {list.length === 0 ? (
          <p className="muted">받은 경고가 없어요. 지금처럼 잘 가꿔 주세요.</p>
        ) : (
          <ol className="space-y-2 border-l-4 border-amber-100 pl-3">
            {list.map((w, i) => (
              <li key={w.id}>
                <p className="font-bold">
                  {i + 1}회 {!reasonHasDate(w) && <span className="muted text-sm font-normal">{formatDate(w.issuedAt)}</span>}
                </p>
                <p>{w.reason}</p>
              </li>
            ))}
          </ol>
        )}
        <p className="muted text-sm">미경작이 확인되면 경고가 부여되고, {limit}회가 쌓이면 구획이 회수돼요. 사유를 확인하고 이의가 있으면 텃밭지원과에 문의해 주세요.</p>
      </section>

      <section aria-label="이용 규칙" className="space-y-1">
        <h3 className="flex items-center gap-2 text-lg font-bold">
          <Sprout aria-hidden className="size-5" /> 이용 규칙
        </h3>
        <p>{garden.rules}</p>
      </section>

      <section aria-label="이용료" className="space-y-2">
        <h3 className="text-lg font-bold">이용료 안내</h3>
        <FeeGuide garden={garden} />
      </section>

      <Link to={`/gardens/${garden.id}`} className="font-bold">
        텃밭 상세 정보 보기
      </Link>
    </article>
  );
}

export default function MyPlots() {
  usePageTitle('내 텃밭');
  const db = useDb();
  const { user, role } = useSession();
  const plots = usedPlots(db, user.id);
  const offers = db.applications.filter((a) => a.userId === user.id && a.status === '당첨');
  const recalled = db.successions.filter((s) => s.fromUserId === user.id && s.reason === '회수');
  const notices = noticesFor(db, role === 'provider' ? '제공자' : '이용자').slice(0, 3);
  const gname = (id: string) => getGarden(db, id)?.name ?? id;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">내 텃밭</h1>
        <p className="muted">이용 중인 구획, 이용 기간, 경고 이력과 이용료 안내를 확인해요.</p>
      </div>

      {offers.length > 0 && (
        <Notice tone="success">
          <p className="font-bold">당첨된 텃밭이 있어요. 수락하면 이곳에서 이용을 시작할 수 있어요.</p>
          <p className="text-sm">
            <Link to="/my/applications">내 신청에서 수락하기</Link> · 민간·개인 텃밭의 이용료 송금 계좌는 수락 후 이곳에서만 안내돼요.
          </p>
        </Notice>
      )}

      {recalled.map((s) => (
        <Notice key={s.id} tone="danger">
          <p className="font-bold">
            {gname(s.gardenId)} 구획이 {formatDate(s.at)}에 회수되었어요.
          </p>
          <p className="text-sm">경고 {db.settings.warningLimit}회 누적으로 회수가 확정되었어요. 경고 사유는 아래 이력에서 확인할 수 있고, 다음 시즌에 다시 신청할 수 있어요.</p>
          <ol className="mt-1 list-decimal pl-5 text-sm">
            {db.warnings.filter((w) => w.userId === user.id && w.plotId === s.plotId).sort((a, b) => a.issuedAt.localeCompare(b.issuedAt)).map((w) => (
              <li key={w.id}>{reasonHasDate(w) ? w.reason : `${formatDate(w.issuedAt)} — ${w.reason}`}</li>
            ))}
          </ol>
        </Notice>
      ))}

      {plots.length === 0 ? (
        <div className="card space-y-3 text-center">
          <p className="text-lg font-bold">이용 중인 텃밭이 없어요.</p>
          <p className="muted">텃밭을 찾아 신청하고 당첨되면 이곳에서 이용 안내를 볼 수 있어요.</p>
          <Link to="/gardens" className="btn btn-primary">
            텃밭 찾기
          </Link>
        </div>
      ) : (
        plots.map((p) => <PlotCard key={p.id} plot={p} />)
      )}

      <section aria-labelledby="notices" className="card space-y-3">
        <h2 id="notices" className="flex items-center gap-2 text-lg font-bold">
          <Megaphone aria-hidden className="size-5" /> 이용자 공지
        </h2>
        {notices.length === 0 ? (
          <p className="muted">등록된 공지가 없어요.</p>
        ) : (
          <ul className="divide-y divide-soil-200">
            {notices.map((n) => (
              <li key={n.id} className="py-3">
                <p className="font-bold">{n.title}</p>
                <p className="muted text-sm">{formatDate(n.createdAt)}</p>
                <p className="mt-1">{n.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
