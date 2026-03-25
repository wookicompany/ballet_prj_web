const detailCacheMap = new Map<string, unknown>();
const detailDirtySet = new Set<string>();

const makeKey = (performanceId: string, userId: string) => `${performanceId}:${userId}`;

export const getDetailCache = <T>(performanceId: string, userId: string): T | null => {
  const key = makeKey(performanceId, userId);
  if (detailDirtySet.has(key)) return null;
  return (detailCacheMap.get(key) as T) ?? null;
};

export const setDetailCache = <T>(performanceId: string, userId: string, value: T) => {
  const key = makeKey(performanceId, userId);
  detailCacheMap.set(key, value);
  detailDirtySet.delete(key);
};

export const invalidateDetailCache = (performanceId: string) => {
  for (const key of detailCacheMap.keys()) {
    if (key.startsWith(`${performanceId}:`)) {
      detailDirtySet.add(key);
    }
  }
};
