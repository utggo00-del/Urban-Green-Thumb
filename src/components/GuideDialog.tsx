import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEMO_GUIDE_EXTRAS, DEMO_GUIDE_STEPS, DEMO_ROLES } from '../config';
import { repo } from '../data/useDb';

/** 심사위원용 5단계 시연 가이드 (SPEC 8.2). 네이티브 <dialog>라 ESC·포커스 가둠이 기본 제공된다. */
export function GuideDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const go = (role: keyof typeof DEMO_ROLES, path: string) => {
    repo.setRole(role);
    navigate(path);
    onClose();
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="guide-title"
      className="m-auto max-h-[92vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl bg-paper p-0 text-ink shadow-2xl"
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-soil-200 bg-paper p-5">
        <div>
          <h2 id="guide-title" className="text-xl font-extrabold">
            시연 가이드 · 5단계
          </h2>
          <p className="muted text-sm">
            처음부터 순서대로 하면 끊김 없이 이어져요. 버튼을 누르면 해당 역할로 전환하고 화면으로 이동해요. 처음 상태로 돌아가려면 위쪽 “데이터 초기화”를 누르세요.
          </p>
        </div>
        <button type="button" className="btn btn-secondary !min-h-11 !px-3" onClick={onClose} aria-label="닫기">
          <X aria-hidden className="size-5" />
        </button>
      </div>

      <ol className="space-y-3 p-5">
        {DEMO_GUIDE_STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-3 rounded-xl border border-soil-200 p-4">
            <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-leaf-700 font-bold text-white">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold">{s.title}</h3>
              <p className="muted mt-1 text-sm">{s.body}</p>
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm">
                {s.checks.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <button type="button" className="btn btn-secondary mt-3 !min-h-11" onClick={() => go(s.role, s.path)}>
                {DEMO_ROLES[s.role].label} 역할로 이동
              </button>
            </div>
          </li>
        ))}
      </ol>

      <section aria-labelledby="guide-extra" className="border-t border-soil-200 p-5">
        <h3 id="guide-extra" className="text-lg font-extrabold">
          더 살펴볼 기능
        </h3>
        <ul className="mt-3 space-y-2">
          {DEMO_GUIDE_EXTRAS.map((x) => (
            <li key={x.title} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-soil-100 p-3">
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{x.title}</span>
                <span className="muted text-sm">{x.body}</span>
              </span>
              <button type="button" className="btn btn-secondary !min-h-11" onClick={() => go(x.role, x.path)}>
                보러 가기
              </button>
            </li>
          ))}
        </ul>
      </section>
    </dialog>
  );
}
