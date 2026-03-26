let locationsCacheData: unknown | null = null;
let locationsCacheDirty = false;

export const getLocationsCache = <T>() => {
  if (locationsCacheDirty) return null;
  return locationsCacheData as T | null;
};

export const setLocationsCache = <T>(value: T) => {
  locationsCacheData = value;
  locationsCacheDirty = false;
};

export const invalidateLocationsCache = () => {
  locationsCacheDirty = true;
};
