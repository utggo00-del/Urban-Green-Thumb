import { useId, type ReactNode } from 'react';

interface ControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

/** 라벨·도움말·오류를 입력 칸과 올바르게 연결해 주는 폼 필드 (스크린 리더 대응) */
export function Field({ label, hint, error, required, children }: { label: string; hint?: string; error?: string; required?: boolean; children: (p: ControlProps) => ReactNode }) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-err` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-bold">
        {label} {required && <span className="text-clay-700" aria-label="필수">*</span>}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {hint && (
        <p id={`${id}-hint`} className="muted mt-1 text-sm">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-1 font-bold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
