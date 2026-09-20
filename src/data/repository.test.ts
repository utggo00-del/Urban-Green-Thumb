import { describe, expect, it } from 'vitest';
import { createMemoryStorage, createRepository } from './repository';
import { DB_VERSION } from './seed';

describe('repository', () => {
  it('처음에는 시드를 적재하고 저장소에 기록한다', () => {
    const storage = createMemoryStorage();
    const repo = createRepository(storage);
    expect(repo.getSnapshot().gardens.length).toBe(16);
    expect(storage.getItem('siheung-garden-demo-db')).toBeTruthy();
  });

  it('update는 새 스냅샷을 만들고 구독자에게 알리며, 재생성해도 유지된다', () => {
    const storage = createMemoryStorage();
    const repo = createRepository(storage);
    const before = repo.getSnapshot();
    let calls = 0;
    const off = repo.subscribe(() => calls++);

    repo.update((d) => {
      d.gardens[0].name = '변경된 이름';
    });
    expect(calls).toBe(1);
    expect(repo.getSnapshot()).not.toBe(before);
    expect(before.gardens[0].name).not.toBe('변경된 이름'); // 이전 스냅샷은 그대로(불변)
    off();
    repo.update((d) => void (d.meta.today = '2026-09-21'));
    expect(calls).toBe(1);

    const reopened = createRepository(storage);
    expect(reopened.getSnapshot().gardens[0].name).toBe('변경된 이름');
    expect(reopened.getSnapshot().meta.today).toBe('2026-09-21');
  });

  it('reset은 시드로 되돌린다', () => {
    const repo = createRepository(createMemoryStorage());
    repo.update((d) => void (d.gardens = []));
    expect(repo.getSnapshot().gardens).toHaveLength(0);
    repo.reset();
    expect(repo.getSnapshot().gardens).toHaveLength(16);
    expect(repo.getSnapshot().session.role).toBe('citizen');
  });

  it('setRole은 역할과 기본 시연 계정을 바꾼다', () => {
    const repo = createRepository(createMemoryStorage());
    repo.setRole('admin');
    expect(repo.getSnapshot().session).toEqual({ role: 'admin', userId: 'u_admin1' });
    repo.setRole('citizen', 'u_c003');
    expect(repo.getSnapshot().session).toEqual({ role: 'citizen', userId: 'u_c003' });
  });

  it('손상되었거나 버전이 다른 저장 데이터는 무시하고 시드로 시작한다', () => {
    const storage = createMemoryStorage();
    storage.setItem('siheung-garden-demo-db', '{not json');
    expect(createRepository(storage).getSnapshot().gardens).toHaveLength(16);
    storage.setItem('siheung-garden-demo-db', JSON.stringify({ meta: { version: 0 } }));
    expect(createRepository(storage).getSnapshot().gardens).toHaveLength(16);
  });

  it('이전 버전(모양이 다른) 저장본은 새 시드로 대체된다', () => {
    const storage = createMemoryStorage();
    const old = createRepository(createMemoryStorage()).getSnapshot();
    old.meta.version = DB_VERSION - 1;
    old.gardens = [];
    storage.setItem('siheung-garden-demo-db', JSON.stringify(old));
    const repo = createRepository(storage);
    expect(repo.getSnapshot().meta.version).toBe(DB_VERSION);
    expect(repo.getSnapshot().gardens).toHaveLength(16);
  });
});
