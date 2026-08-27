import { supabase } from '@/integrations/supabase/client';
import { getFollowerIds, postGoalEvent } from '@/lib/social';

export type GoalStatus = 'active' | 'completed' | 'abandoned';

export interface Goal {
  id: string;
  user_id: string;
  target_days: number;
  start_streak: number;
  status: GoalStatus;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

/**
 * The lowest target a user may pick. A goal must be something still ahead of
 * them, so it is always their current streak plus one. After a relapse the
 * floor drops with the streak — someone rebuilding from zero can set a small,
 * reachable goal rather than being held to a past best.
 */
export const minGoalTarget = (currentStreak: number) => currentStreak + 1;

export const getActiveGoal = async (userId: string): Promise<Goal | null> => {
  const { data } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  return (data as Goal) ?? null;
};

export const getGoalHistory = async (userId: string): Promise<Goal[]> => {
  const { data } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return (data as Goal[]) ?? [];
};

/**
 * Start a new goal, abandoning any active one. Returns an error string when
 * the target is not above the current streak.
 */
export const setGoal = async (
  userId: string,
  targetDays: number,
  currentStreak: number,
): Promise<string | null> => {
  if (targetDays < minGoalTarget(currentStreak)) {
    return `Pick a goal above your current ${currentStreak}-day streak.`;
  }

  // Only one active goal at a time — the old one becomes history.
  await supabase
    .from('goals')
    .update({ status: 'abandoned' })
    .eq('user_id', userId)
    .eq('status', 'active');

  const { error } = await supabase.from('goals').insert({
    user_id: userId,
    target_days: targetDays,
    start_streak: currentStreak,
    status: 'active',
  });
  if (error) {
    console.warn('[goals] insert failed:', error.message);
    return 'Could not save that goal. Try again.';
  }

  // Keep the denormalised copy on profiles in step; it is what other people's
  // profiles read for the GOAL DAYS stat.
  await supabase.from('profiles').update({ clean_day_goal: targetDays }).eq('id', userId);

  const followerIds = await getFollowerIds(userId);
  await postGoalEvent(userId, 'goal_set', targetDays, followerIds);
  return null;
};

/**
 * Mark a goal completed. `silent` skips the feed post and follower
 * notifications — used when reconciling a goal that was already met before the
 * lifecycle existed, where the completion date is unknown and announcing it
 * would be misleading.
 */
export const completeGoal = async (
  goal: Goal,
  opts: { silent?: boolean } = {},
): Promise<void> => {
  const { error } = await supabase
    .from('goals')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', goal.id)
    .eq('status', 'active');
  if (error) {
    console.warn('[goals] complete failed:', error.message);
    return;
  }
  if (opts.silent) return;

  const followerIds = await getFollowerIds(goal.user_id);
  await postGoalEvent(goal.user_id, 'goal_met', goal.target_days, followerIds);
};
