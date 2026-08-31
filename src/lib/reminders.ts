import { LocalNotifications } from '@capacitor/local-notifications';
import { Entry, formatDateKey } from '@/lib/entries';

/**
 * Daily "log your day" reminder.
 *
 * iOS cannot run a condition at fire time, so a single repeating notification
 * would nag on days already logged. Instead we schedule one notification per
 * day for the next few weeks, skipping days that already have an entry, and
 * re-sync whenever that could have changed: app open, after a log, and when
 * the setting changes.
 */

const STORAGE_KEY = 'gacker.reminder';
// iOS caps pending notifications at 64 per app. Well under it, and re-synced
// often enough that the window never runs dry.
const DAYS_AHEAD = 21;
// Deterministic id range, so a re-sync can clear exactly its own notifications
// without touching anything else scheduled later.
const ID_BASE = 900000;

export interface ReminderSetting {
  enabled: boolean;
  hour: number;   // 0–23, device local time
  minute: number;
}

export const defaultReminder: ReminderSetting = { enabled: false, hour: 21, minute: 0 };

export const loadReminder = (): ReminderSetting => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultReminder;
    return { ...defaultReminder, ...JSON.parse(raw) };
  } catch {
    return defaultReminder;
  }
};

export const saveReminder = (setting: ReminderSetting) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(setting));
  } catch {
    // A full or unavailable store is not worth failing the toggle over.
  }
};

/** Asks only if not already decided; returns whether we may post notifications. */
export const ensureReminderPermission = async (): Promise<boolean> => {
  const current = await LocalNotifications.checkPermissions();
  if (current.display === 'granted') return true;
  if (current.display === 'denied') return false;
  const asked = await LocalNotifications.requestPermissions();
  return asked.display === 'granted';
};

const clearScheduled = async () => {
  const pending = await LocalNotifications.getPending();
  const ours = pending.notifications.filter(n => n.id >= ID_BASE && n.id < ID_BASE + DAYS_AHEAD);
  if (ours.length > 0) {
    await LocalNotifications.cancel({ notifications: ours.map(n => ({ id: n.id })) });
  }
};

/**
 * Rebuild the reminder schedule from scratch. Safe to call often — it always
 * clears its own pending notifications first, so it cannot pile up duplicates.
 */
export const syncDailyReminders = async (
  setting: ReminderSetting,
  entries: Record<string, Entry>,
): Promise<void> => {
  try {
    await clearScheduled();
    if (!setting.enabled) return;
    if (!(await ensureReminderPermission())) return;

    const now = new Date();
    const toSchedule: Parameters<typeof LocalNotifications.schedule>[0]['notifications'] = [];

    for (let offset = 0; offset < DAYS_AHEAD; offset++) {
      const day = new Date(now);
      day.setDate(day.getDate() + offset);
      day.setHours(setting.hour, setting.minute, 0, 0);

      // Today's slot has usually passed by the time this runs.
      if (day <= now) continue;
      // Already logged — nothing to remind about.
      if (formatDateKey(day) in entries) continue;

      toSchedule.push({
        id: ID_BASE + offset,
        title: 'The Gacker',
        body: "How did today go? Log it to keep your streak honest.",
        schedule: { at: day, allowWhileIdle: true },
      });
    }

    if (toSchedule.length > 0) {
      await LocalNotifications.schedule({ notifications: toSchedule });
    }
  } catch (e) {
    console.warn('[reminders] sync failed:', e);
  }
};
