let brandHomeCache: unknown | null = null;
let brandHomeCacheDirty = false;

export const getBrandHomeCache = <T>() => {
  if (brandHomeCacheDirty) return null;
  return brandHomeCache as T | null;
};

export const setBrandHomeCache = <T>(value: T) => {
  brandHomeCache = value;
  brandHomeCacheDirty = false;
};

export const invalidateBrandHomeCache = () => {
  brandHomeCacheDirty = true;
};
