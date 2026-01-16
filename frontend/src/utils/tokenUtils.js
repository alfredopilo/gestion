const LAST_ACTIVITY_KEY = 'lastActivityAt';
const SESSION_START_KEY = 'sessionStartAt';

const safeAtob = (value) => {
  try {
    return atob(value);
  } catch {
    return null;
  }
};

export const decodeJwtPayload = (token) => {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const payload = safeAtob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
  if (!payload) return null;
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
};

export const getTokenExpiration = (token) => {
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.exp) return null;
  return payload.exp * 1000;
};

export const isTokenExpired = (token, skewMs = 0) => {
  const exp = getTokenExpiration(token);
  if (!exp) return true;
  return Date.now() + skewMs >= exp;
};

export const getLastActivityTimestamp = () => {
  const raw = sessionStorage.getItem(LAST_ACTIVITY_KEY);
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
};

export const getSessionStartTimestamp = () => {
  const raw = sessionStorage.getItem(SESSION_START_KEY);
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
};

export const setSessionStartTimestamp = (timestamp) => {
  sessionStorage.setItem(SESSION_START_KEY, String(timestamp));
};

export const setLastActivityTimestamp = (timestamp) => {
  sessionStorage.setItem(LAST_ACTIVITY_KEY, String(timestamp));
};

export const clearSessionActivity = () => {
  sessionStorage.removeItem(LAST_ACTIVITY_KEY);
  sessionStorage.removeItem(SESSION_START_KEY);
};

export const isSessionActive = (timeoutMs) => {
  const lastActivity = getLastActivityTimestamp();
  if (!lastActivity) return false;
  return Date.now() - lastActivity < timeoutMs;
};
