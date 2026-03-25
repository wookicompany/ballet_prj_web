const cacheMap = new Map<string, unknown>();
const dirtySet = new Set<string>();

export const getSearchCache = <T>(sectionKey: string): T | null => {
  if (dirtySet.has(sectionKey)) return null;
  return (cacheMap.get(sectionKey) as T) ?? null;
};

export const setSearchCache = <T>(sectionKey: string, value: T) => {
  cacheMap.set(sectionKey, value);
  dirtySet.delete(sectionKey);
};

export const invalidateSearchCache = (sectionKey?: string) => {
  if (sectionKey) {
    dirtySet.add(sectionKey);
  } else {
    for (const key of cacheMap.keys()) {
      dirtySet.add(key);
    }
  }
};
