const profileCacheMap = new Map<string, unknown>();
const profileDirtySet = new Set<string>();

export const getProfileCache = <T>(userId: string): T | null => {
  if (profileDirtySet.has(userId)) return null;
  return (profileCacheMap.get(userId) as T) ?? null;
};

export const setProfileCache = <T>(userId: string, value: T) => {
  profileCacheMap.set(userId, value);
  profileDirtySet.delete(userId);
};

export const invalidateProfileCache = (userId: string) => {
  profileDirtySet.add(userId);
};
