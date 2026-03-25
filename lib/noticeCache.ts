let noticeCacheData: unknown | null = null;
let noticeCacheDirty = false;

export const getNoticeCache = <T>() => {
  if (noticeCacheDirty) return null;
  return noticeCacheData as T | null;
};

export const setNoticeCache = <T>(value: T) => {
  noticeCacheData = value;
  noticeCacheDirty = false;
};

export const invalidateNoticeCache = () => {
  noticeCacheDirty = true;
};
