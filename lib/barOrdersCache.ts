let barOrdersCacheData: unknown | null = null;
let barOrdersCacheDirty = false;

export const getBarOrdersCache = <T>() => {
  if (barOrdersCacheDirty) return null;
  return barOrdersCacheData as T | null;
};

export const setBarOrdersCache = <T>(value: T) => {
  barOrdersCacheData = value;
  barOrdersCacheDirty = false;
};

export const invalidateBarOrdersCache = () => {
  barOrdersCacheDirty = true;
};
