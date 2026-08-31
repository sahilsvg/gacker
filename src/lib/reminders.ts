import { LocalNotifications } from '@capacitor/local-notifications';
import { Entry, formatDateKey } from '@/lib/entries';
import { Quote } from '@/lib/quotes';

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

// Quotes get their own id range and a shorter window. iOS caps pending
// notifications at 64 per app: 21 reminders plus 7 days x 2 quotes is 35, which
// leaves comfortable headroom. The window is topped up on every foreground.
const QUOTE_ID_BASE = 910000;
const QUOTE_DAYS_AHEAD = 7;
const QUOTES_PER_DAY = 2;
// Waking hours, split into one slot per quote so two never land together.
const QUOTE_START_HOUR = 9;
const QUOTE_END_HOUR = 21;

export interface ReminderSetting {
  enabled: boolean;
  hour: number;   // 0–23, device local time
  minute: number;
  /** Motivational quotes at random times through the day. */
  quotes: boolean;
}

export const defaultReminder: ReminderSetting = {
  enabled: false, hour: 21, minute: 0, quotes: false,
};

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


// ─── Motivational quotes ─────────────────────────────────────────────────────

/**
 * Deterministic PRNG. The schedule is rebuilt on every foreground, so random
 * times have to be stable for a given day — otherwise a quote due in five
 * minutes could be shuffled to tomorrow, or fire twice after being moved.
 * Seeding from the date makes every rebuild produce the same schedule.
 */
const seedFrom = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

const random01 = (seed: number): number => {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const clearScheduledQuotes = async () => {
  const pending = await LocalNotifications.getPending();
  const ours = pending.notifications.filter(
    n => n.id >= QUOTE_ID_BASE && n.id < QUOTE_ID_BASE + QUOTE_DAYS_AHEAD * QUOTES_PER_DAY,
  );
  if (ours.length > 0) {
    await LocalNotifications.cancel({ notifications: ours.map(n => ({ id: n.id })) });
  }
};

export const syncQuoteNotifications = async (
  setting: ReminderSetting,
  quotes: Quote[],
): Promise<void> => {
  try {
    await clearScheduledQuotes();
    if (!setting.quotes || quotes.length === 0) return;
    if (!(await ensureReminderPermission())) return;

    const now = new Date();
    const slotMinutes = ((QUOTE_END_HOUR - QUOTE_START_HOUR) * 60) / QUOTES_PER_DAY;
    const toSchedule: Parameters<typeof LocalNotifications.schedule>[0]['notifications'] = [];

    for (let offset = 0; offset < QUOTE_DAYS_AHEAD; offset++) {
      const day = new Date(now);
      day.setDate(day.getDate() + offset);
      const dateKey = formatDateKey(day);

      for (let slot = 0; slot < QUOTES_PER_DAY; slot++) {
        const seed = seedFrom(`${dateKey}:${slot}`);
        const at = new Date(day);
        const minuteInSlot = Math.floor(random01(seed) * slotMinutes);
        at.setHours(QUOTE_START_HOUR, slot * slotMinutes + minuteInSlot, 0, 0);

        // Give the log reminder room so the two never arrive together.
        const reminderAt = new Date(day);
        reminderAt.setHours(setting.hour, setting.minute, 0, 0);
        if (setting.enabled && Math.abs(at.getTime() - reminderAt.getTime()) < 30 * 60_000) {
          at.setMinutes(at.getMinutes() - 45);
        }

        if (at <= now) continue;

        const quote = quotes[Math.floor(random01(seed + 1) * quotes.length) % quotes.length];
        toSchedule.push({
          id: QUOTE_ID_BASE + offset * QUOTES_PER_DAY + slot,
          title: quote.author ?? 'The Gacker',
          body: quote.body,
          schedule: { at, allowWhileIdle: true },
        });
      }
    }

    if (toSchedule.length > 0) {
      await LocalNotifications.schedule({ notifications: toSchedule });
    }
  } catch (e) {
    console.warn('[quotes] sync failed:', e);
  }
};
