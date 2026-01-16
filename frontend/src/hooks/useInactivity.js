import { useCallback, useEffect, useRef } from 'react';

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_WARNING_MS = 60 * 1000;
const LAST_ACTIVITY_KEY = 'lastActivityAt';

const readLastActivity = () => {
  const raw = sessionStorage.getItem(LAST_ACTIVITY_KEY);
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
};

const writeLastActivity = (timestamp) => {
  sessionStorage.setItem(LAST_ACTIVITY_KEY, String(timestamp));
};

export const useInactivity = ({
  timeoutMs = DEFAULT_TIMEOUT_MS,
  warningMs = DEFAULT_WARNING_MS,
  onTimeout,
  onWarning,
  enabled = true,
} = {}) => {
  const warningShownRef = useRef(false);

  const registerActivity = useCallback(() => {
    if (!enabled) return;
    writeLastActivity(Date.now());
    warningShownRef.current = false;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const existing = readLastActivity();
    if (!existing) {
      writeLastActivity(Date.now());
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    const handler = () => registerActivity();

    events.forEach((eventName) => {
      window.addEventListener(eventName, handler, { passive: true });
    });

    const intervalId = setInterval(() => {
      const lastActivity = readLastActivity();
      const now = Date.now();
      const inactivityMs = now - lastActivity;

      if (inactivityMs >= timeoutMs) {
        if (typeof onTimeout === 'function') {
          onTimeout();
        }
        return;
      }

      if (!warningShownRef.current && inactivityMs >= timeoutMs - warningMs) {
        warningShownRef.current = true;
        if (typeof onWarning === 'function') {
          onWarning();
        }
      }
    }, 60000);

    return () => {
      clearInterval(intervalId);
      events.forEach((eventName) => {
        window.removeEventListener(eventName, handler);
      });
    };
  }, [enabled, onTimeout, onWarning, registerActivity, timeoutMs, warningMs]);

  return { registerActivity };
};
