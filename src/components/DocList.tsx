import { Eye, FileText, Paperclip, X } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';

/**
 * 서류 열람(모의). 프로토타입은 파일 내용을 저장하지 않고 파일명만 보관하므로,
 * “열람”은 안내 창만 띄운다. 실서비스에서는 접근 권한을 확인한 뒤 보안 저장소의 파일을 연다.
 */
export function DocList({ title, files, note }: { title: string; files: string[]; note?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <div>
      <h3 className="mb-1 font-bold">{title}</h3>
      {files.length === 0 ? (
        <p className="muted text-sm">첨부된 파일이 없어요.</p>
      ) : (
        <ul className="space-y-1">
          {files.map((f) => (
            <li key={f} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-soil-200 px-3 py-2">
              <span className="flex min-w-0 items-center gap-2">
                <FileText aria-hidden className="size-5 shrink-0 text-leaf-700" />
                <span className="break-all">{f}</span>
              </span>
              <button type="button" className="btn btn-secondary !min-h-11 !py-1" onClick={() => setOpen(f)} aria-label={`${f} 열람(모의)`}>
                <Eye aria-hidden className="size-4" /> 열람
              </button>
            </li>
          ))}
        </ul>
      )}
      {note && <p className="muted mt-1 text-sm">{note}</p>}
      <dialog ref={ref} onClose={() => setOpen(null)} aria-labelledby="doc-title" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-paper p-5 text-ink shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id="doc-title" className="break-all text-lg font-extrabold">
            {open}
          </h2>
          <button type="button" className="btn btn-secondary !min-h-11 !px-3" onClick={() => setOpen(null)} aria-label="닫기">
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <div className="grid h-40 place-items-center rounded-xl border-2 border-dashed border-soil-200 bg-soil-100 p-4 text-center">
          <p>
            <strong>시연용 모의 문서</strong>
            <br />
            <span className="muted text-sm">프로토타입은 파일 내용을 저장하지 않고 파일명만 보관합니다. 실서비스에서는 권한 확인 후 원본을 열람합니다.</span>
          </p>
        </div>
      </dialog>
    </div>
  );
}

/** 파일 첨부(모의): 선택한 파일의 이름만 기록한다. */
export function FileAttach({
  id,
  label,
  files,
  onChange,
  multiple,
  error,
  describedBy,
}: {
  id: string;
  label: string;
  files: string[];
  onChange: (files: string[]) => void;
  multiple?: boolean;
  error?: string;
  describedBy?: string;
}) {
  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const names = Array.from(e.target.files ?? []).map((f) => f.name);
    if (names.length) onChange(multiple ? [...new Set([...files, ...names])] : names.slice(0, 1));
    e.target.value = '';
  };
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="btn btn-secondary cursor-pointer">
        <Paperclip aria-hidden className="size-5" /> {label}
      </label>
      {/* 시각적으로만 숨기고 키보드로 접근 가능하게 둔다 */}
      <input id={id} type="file" multiple={multiple} onChange={pick} className="sr-only" aria-invalid={!!error} aria-describedby={describedBy} />
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f) => (
            <li key={f} className="flex items-center justify-between gap-2 rounded-lg bg-leaf-50 px-3 py-2">
              <span className="break-all">{f}</span>
              <button type="button" className="btn btn-secondary !min-h-10 !px-3 !py-0" onClick={() => onChange(files.filter((x) => x !== f))} aria-label={`${f} 첨부 삭제`}>
                <X aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
