export interface DayEntry {
  clean: boolean;
  notes: string;
  timestamp: number;
}

export interface GackerUser {
  name: string;
  handle: string;
}

const ENTRIES_KEY = 'gacker_entries';
const USER_KEY = 'gacker_user';

export const getUser = (): GackerUser | null => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

export const saveUser = (user: GackerUser) => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const getEntries = (): Record<string, DayEntry> => {
  try {
    const raw = localStorage.getItem(ENTRIES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};

export const saveEntry = (dateKey: string, entry: DayEntry) => {
  const entries = getEntries();
  entries[dateKey] = entry;
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
};

export const formatDateKey = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const computeStats = (entries: Record<string, DayEntry>) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const keys = Object.keys(entries).sort();
  let streak = 0;
  let cleanDays = 0;
  let redDays = 0;

  for (const key of keys) {
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (date > today) continue;
    if (entries[key].clean) cleanDays++;
    else redDays++;
  }

  // streak: consecutive clean days going backwards from today
  const check = new Date(today);
  while (true) {
    const key = formatDateKey(check);
    if (!(key in entries)) break;
    if (!entries[key].clean) break;
    streak++;
    check.setDate(check.getDate() - 1);
  }

  return { streak, cleanDays, redDays };
};
