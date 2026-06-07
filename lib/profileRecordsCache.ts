type CacheEntry<T> = {
  userId: string;
  value: T;
  dirty: boolean;
};

let entry: CacheEntry<unknown> | null = null;

export const getProfileRecordsCache = <T>(userId: string): T | null => {
  if (!entry || entry.dirty || entry.userId !== userId) return null;
  return entry.value as T;
};

// userId 검증 없이 동기적으로 읽기 (useState 초기값 설정 전용)
export const getProfileRecordsCacheUnsafe = <T>(): T | null => {
  if (!entry || entry.dirty) return null;
  return entry.value as T;
};

export const setProfileRecordsCache = <T>(userId: string, value: T) => {
  entry = { userId, value, dirty: false };
};

export const invalidateProfileRecordsCache = (userId: string) => {
  if (entry?.userId === userId) {
    entry.dirty = true;
  }
};
