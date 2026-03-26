let instructorLevelsCacheData: unknown | null = null;
let instructorLevelsCacheDirty = false;

export const getInstructorLevelsCache = <T>() => {
  if (instructorLevelsCacheDirty) return null;
  return instructorLevelsCacheData as T | null;
};

export const setInstructorLevelsCache = <T>(value: T) => {
  instructorLevelsCacheData = value;
  instructorLevelsCacheDirty = false;
};

export const invalidateInstructorLevelsCache = () => {
  instructorLevelsCacheDirty = true;
};
