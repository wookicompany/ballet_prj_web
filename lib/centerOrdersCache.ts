let centerOrdersCacheData: unknown | null = null;
let centerOrdersCacheDirty = false;

export const getCenterOrdersCache = <T>() => {
  if (centerOrdersCacheDirty) return null;
  return centerOrdersCacheData as T | null;
};

export const setCenterOrdersCache = <T>(value: T) => {
  centerOrdersCacheData = value;
  centerOrdersCacheDirty = false;
};

export const invalidateCenterOrdersCache = () => {
  centerOrdersCacheDirty = true;
};
