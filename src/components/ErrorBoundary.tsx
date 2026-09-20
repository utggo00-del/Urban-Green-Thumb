import { TriangleAlert } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { repo } from '../data/useDb';

interface Props {
  children: ReactNode;
  /** 값이 바뀌면(화면 이동) 오류 상태를 풀고 다시 그린다 */
  resetKey?: string;
}

/**
 * 화면 하나가 예기치 않게 실패해도 앱 전체가 하얗게 멈추지 않게 한다.
 * 저장된 데이터가 손상되었을 가능성에 대비해 “시연 데이터 초기화” 출구도 함께 둔다.
 */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('화면 오류', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-xl px-4 py-10">
        <div role="alert" className="card space-y-4">
          <h1 className="flex items-center gap-2 text-xl font-extrabold">
            <TriangleAlert aria-hidden className="size-6 text-clay-700" /> 화면을 불러오지 못했어요
          </h1>
          <p>잠시 문제가 생겼어요. 다시 시도해 보시고, 계속되면 시연 데이터를 처음 상태로 되돌려 주세요.</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" className="btn btn-primary" onClick={() => this.setState({ error: null })}>
              다시 시도
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                repo.reset();
                window.location.hash = '#/';
                this.setState({ error: null });
              }}
            >
              시연 데이터 초기화
            </button>
          </div>
        </div>
      </main>
    );
  }
}
