import { AlertTriangle, Building2, CheckCircle2, Circle, House, Info, Landmark, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Tone } from '../lib/labels';
import type { OwnerKind } from '../types';

const STYLE: Record<Tone, { cls: string; Icon: typeof Info }> = {
  neutral: { cls: 'bg-soil-100 text-soil-700', Icon: Circle },
  info: { cls: 'bg-sky-100 text-sky-800', Icon: Info },
  success: { cls: 'bg-leaf-100 text-leaf-800', Icon: CheckCircle2 },
  warn: { cls: 'bg-amber-100 text-amber-800', Icon: AlertTriangle },
  danger: { cls: 'bg-red-100 text-red-700', Icon: XCircle },
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  const { cls, Icon } = STYLE[tone];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-bold ${cls}`}>
      <Icon aria-hidden className="size-4 shrink-0" />
      {children}
    </span>
  );
}

/** 안내·경고 문구 박스 (아이콘 + 텍스트) */
export function Notice({ tone = 'info', children }: { tone?: Tone; children: ReactNode }) {
  const { cls, Icon } = STYLE[tone];
  return (
    <div role={tone === 'danger' || tone === 'warn' ? 'alert' : 'note'} className={`flex gap-3 rounded-xl p-4 ${cls}`}>
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

const KIND_STYLE: Record<OwnerKind, { cls: string; Icon: typeof Info }> = {
  공공: { cls: 'bg-leaf-100 text-leaf-800', Icon: Landmark },
  민간: { cls: 'bg-clay-100 text-clay-700', Icon: Building2 },
  개인: { cls: 'bg-sky-100 text-sky-800', Icon: House },
};

/** 공공/민간/개인 텃밭 유형 배지 (지도 마커와 같은 색·글자 체계) */
export function KindBadge({ kind }: { kind: OwnerKind }) {
  const { cls, Icon } = KIND_STYLE[kind];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-bold ${cls}`}>
      <Icon aria-hidden className="size-4 shrink-0" />
      {kind} 텃밭
    </span>
  );
}
