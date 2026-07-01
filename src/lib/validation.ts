export const validateHandle = (handle: string): string | null => {
  if (handle.length < 3) return 'Username must be at least 3 characters.';
  if (handle.length > 13) return 'Username must be 13 characters or fewer.';
  if (!/^[a-z0-9_.]+$/.test(handle)) return 'Letters, numbers, _ and . only.';
  return null;
};

export const validateName = (name: string): string | null => {
  if (!name.trim()) return 'Name is required.';
  if (name.length > 20) return 'Name must be 20 characters or fewer.';
  if (!/^[a-zA-Z\s]+$/.test(name)) return 'Name can only contain letters and spaces.';
  return null;
};

export const sanitizeHandle = (raw: string): string =>
  raw.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 13);

export const sanitizeName = (raw: string): string =>
  raw.replace(/[^a-zA-Z\s]/g, '').slice(0, 20);
