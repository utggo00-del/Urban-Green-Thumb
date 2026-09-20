// 데이터 접근 계층 — 화면은 localStorage를 직접 만지지 않고 이 모듈만 사용한다.
//
// 실서비스 전환 메모: 이 인터페이스(getSnapshot / subscribe / update / reset)를 REST·GraphQL 등의
// API 클라이언트로 바꿔 끼우면 화면 코드는 그대로 둘 수 있다. (네트워크 호출은 비동기이므로 그때
// update를 Promise 기반으로 확장한다.)
import { DEMO_ROLES } from '../config';
import type { Db, DemoRole } from '../types';
import { buildSeed, DB_VERSION } from './seed';

const STORAGE_KEY = 'siheung-garden-demo-db';

/** localStorage와 같은 최소 인터페이스. 테스트에서는 메모리 구현을 넣는다. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface Repository {
  getSnapshot(): Db;
  subscribe(listener: () => void): () => void;
  /** 변경 함수는 복사본(draft)을 받는다. 반환 후 저장하고 구독자에게 알린다. */
  update(mutator: (draft: Db) => void): void;
  /** 시연 데이터 초기화: 저장소를 비우고 시드를 다시 적재한다. */
  reset(): void;
  /** 시연용 역할 전환 (실서비스에서는 인증으로 대체) */
  setRole(role: DemoRole, userId?: string): void;
}

export function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

/** 사생활 보호 모드 등으로 localStorage가 막힌 경우에도 앱이 동작하도록 메모리로 대체한다. */
function browserStorage(): StorageLike {
  try {
    const s = window.localStorage;
    const probe = `${STORAGE_KEY}-probe`;
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return createMemoryStorage();
  }
}

function load(storage: StorageLike): Db {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Db;
      if (parsed?.meta?.version === DB_VERSION) return parsed;
    }
  } catch {
    // 손상된 저장 데이터 → 시드로 대체
  }
  return buildSeed();
}

export function createRepository(storage: StorageLike): Repository {
  let db = load(storage);
  const listeners = new Set<() => void>();

  const persist = () => {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      // 저장 공간 부족 등 — 메모리 상태로 계속 동작
    }
  };
  const emit = () => listeners.forEach((l) => l());

  persist();

  const repo: Repository = {
    getSnapshot: () => db,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(mutator) {
      const draft = structuredClone(db);
      mutator(draft);
      db = draft;
      persist();
      emit();
    },
    reset() {
      storage.removeItem(STORAGE_KEY);
      db = buildSeed();
      persist();
      emit();
    },
    setRole(role, userId) {
      repo.update((d) => {
        d.session = { role, userId: userId ?? DEMO_ROLES[role].defaultUserId };
      });
    },
  };

  // 다른 탭에서 바뀐 경우 반영
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) {
        db = load(storage);
        emit();
      }
    });
  }

  return repo;
}

let singleton: Repository | null = null;
/** 앱 전역 저장소 (브라우저 localStorage 기반) */
export function getRepository(): Repository {
  return (singleton ??= createRepository(browserStorage()));
}
