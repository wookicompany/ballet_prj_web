let searchInputCacheData: unknown | null = null;
let searchInputCacheDirty = false;

export const getSearchInputCache = <T>() => {
  if (searchInputCacheDirty) return null;
  return searchInputCacheData as T | null;
};

export const setSearchInputCache = <T>(value: T) => {
  searchInputCacheData = value;
  searchInputCacheDirty = false;
};

export const invalidateSearchInputCache = () => {
  searchInputCacheDirty = true;
};
