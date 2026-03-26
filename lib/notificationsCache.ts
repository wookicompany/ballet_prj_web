let notificationsCacheData: unknown | null = null;
let notificationsCacheDirty = false;

export const getNotificationsCache = <T>() => {
  if (notificationsCacheDirty) return null;
  return notificationsCacheData as T | null;
};

export const setNotificationsCache = <T>(value: T) => {
  notificationsCacheData = value;
  notificationsCacheDirty = false;
};

export const invalidateNotificationsCache = () => {
  notificationsCacheDirty = true;
};
