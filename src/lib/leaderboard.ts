import { supabase } from '@/integrations/supabase/client';
import { formatDateKey } from '@/lib/entries';

export interface LeaderboardEntry {
  user_id: string;
  name: string;
  handle: string;
  avatar_url: string | null;
  clean_days: number;
  red_days: number;
  /** Percentage, same formula Ganalytics uses for your own fire rate. */
  fire_rate: number;
  /** 1-based; lower fire rate ranks higher. */
  rank: number;
}

type LeaderboardRow = Omit<LeaderboardEntry, 'rank'>;

// This function was just added and the generated Supabase types are not
// regenerated in this repo (same gap as the goals/quotes/goal_events tables
// added earlier), so .rpc() sees zero known functions and types its name
// argument as `never`. Widening supabase's own type at the call site routes
// around that without changing what is sent over the wire -- unlike pulling
// `rpc` out into its own const, this keeps it a method call on `supabase`,
// so `this` inside the client is still bound correctly.
type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: LeaderboardRow[] | null; error: { message: string } | null }>;
};

export const getLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  try {
    // The ranking's day-boundary is the viewer's own local midnight, same as
    // every other date in this app (streak, calendar, reminders) -- not the
    // database server's UTC clock, which can disagree by several hours.
    const { data, error } = await (supabase as unknown as RpcClient).rpc('get_fire_rate_leaderboard', {
      viewer_today: formatDateKey(new Date()),
    });
    if (error) {
      console.warn('[leaderboard] fetch failed:', error.message);
      return [];
    }
    return (data ?? []).map((row, i) => ({ ...row, rank: i + 1 }));
  } catch (e) {
    // Never let a network hiccup or a missing function leave the caller
    // waiting on a promise that never settles.
    console.warn('[leaderboard] fetch threw:', e);
    return [];
  }
};
