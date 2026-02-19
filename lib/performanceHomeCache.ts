let performanceHomeCache: unknown | null = null;
let performanceHomeCacheDirty = false;

export const getPerformanceHomeCache = <T>() => {
  if (performanceHomeCacheDirty) return null;
  return performanceHomeCache as T | null;
};

export const setPerformanceHomeCache = <T>(value: T) => {
  performanceHomeCache = value;
  performanceHomeCacheDirty = false;
};

export const invalidatePerformanceHomeCache = () => {
  performanceHomeCacheDirty = true;
};
