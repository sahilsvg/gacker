import { supabase } from '@/integrations/supabase/client';
import { getFollowerIds, postGoalEvent, goalMilestones } from '@/lib/social';

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
  /** Highest milestone (in streak-days) already posted for this goal. */
  last_milestone_day: number;
  /** Predates milestone tracking; completes quietly rather than announcing. */
  legacy: boolean;
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

  // Clear the denormalised copy so the profile's GOAL DAYS stat shows "—"
  // rather than a target that has already been met.
  await supabase.from('profiles').update({ clean_day_goal: null }).eq('id', goal.user_id);

  if (opts.silent) return;

  const followerIds = await getFollowerIds(goal.user_id);
  await postGoalEvent(goal.user_id, 'goal_met', goal.target_days, followerIds);
};

/**
 * Bring a goal up to date with the current streak: post any milestones newly
 * reached, and complete it if the target is met.
 *
 * Called both after logging and when Ganalytics loads, because the streak now
 * advances with the calendar — a goal can be reached without the user logging
 * anything. `last_milestone_day` makes that safe to call repeatedly: a
 * milestone posts once and is never re-announced on a later app open.
 */
export const syncGoalProgress = async (
  goal: Goal,
  streak: number,
): Promise<{ completed: boolean }> => {
  // A goal carried over from before this existed, already passed, is history:
  // close it quietly rather than announcing something that happened weeks ago.
  if (goal.legacy && streak >= goal.target_days) {
    await completeGoal(goal, { silent: true });
    return { completed: true };
  }

  const due = goalMilestones(goal.target_days).filter(
    m => m.day > goal.last_milestone_day && m.day <= streak,
  );

  if (due.length > 0) {
    // goal_met is posted by completeGoal below, so it is not posted twice.
    const progress = due.filter(m => m.type !== 'goal_met');
    if (progress.length > 0) {
      const followerIds = await getFollowerIds(goal.user_id);
      for (const m of progress) {
        await postGoalEvent(goal.user_id, m.type, goal.target_days, followerIds);
      }
    }
    await supabase
      .from('goals')
      .update({ last_milestone_day: Math.max(...due.map(m => m.day)) })
      .eq('id', goal.id);
  }

  if (streak >= goal.target_days) {
    await completeGoal(goal);
    return { completed: true };
  }
  return { completed: false };
};
