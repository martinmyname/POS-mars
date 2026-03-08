import { useEffect, useMemo, useRef } from 'react';
import { useDayBoundaryTick } from '@/hooks/useDayBoundaryTick';
import { useCashSessions, cashSessionsApi, generateId } from '@/hooks/useData';
import { useAuth } from '@/context/AuthContext';
import { getTodayInAppTz } from '@/lib/appTimezone';

/**
 * When a new day starts (or app loads with no session for today), automatically open
 * a cash session using the last closed session's closing amount, if the user hasn't
 * opened one manually.
 */
export function useAutoOpenCashSession(): void {
  const tick = useDayBoundaryTick();
  const { data: sessionsList } = useCashSessions({ realtime: true });
  const { user } = useAuth();
  const didRunForToday = useRef<string | null>(null);

  const todayStr = getTodayInAppTz();
  const sessions = useMemo(
    () => [...sessionsList].sort((a, b) => (b.date > a.date ? 1 : -1)),
    [sessionsList]
  );
  const todaySession = useMemo(
    () => sessions.find((s) => s.date === todayStr && !s.closedAt) ?? null,
    [sessions, todayStr]
  );
  const lastClosedSession = useMemo(
    () => sessions.find((s) => s.closedAt && s.closingAmount != null) ?? null,
    [sessions]
  );

  useEffect(() => {
    if (!user) return;
    if (todaySession) return;
    if (lastClosedSession?.closingAmount == null) return;
    if (didRunForToday.current === todayStr) return;

    let cancelled = false;
    cashSessionsApi
      .getByDate(todayStr)
      .then((existing) => {
        if (cancelled) return;
        if (existing) return;
        didRunForToday.current = todayStr;
        return cashSessionsApi.insert({
          id: `cash_${generateId()}`,
          date: todayStr,
          openingAmount: lastClosedSession!.closingAmount!,
          openedAt: new Date().toISOString(),
          openedBy: user.email || 'Staff',
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [tick, todayStr, user, todaySession, lastClosedSession]);
}
