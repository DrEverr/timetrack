function getElapsedParts(startISO: string, end: Date = new Date()): {
  hours: number;
  minutes: number;
  seconds: number;
} {
  const start = new Date(startISO);
  const diffMs = end.getTime() - start.getTime();

  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);

  return {
    hours,
    minutes: totalMinutes % 60,
    seconds: totalSeconds % 60,
  };
}

export function formatElapsedTime(startISO: string): string {
  const { hours, minutes, seconds } = getElapsedParts(startISO);

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(" ");
}

export function formatElapsedCompact(startISO: string): string {
  const { hours, minutes, seconds } = getElapsedParts(startISO);

  if (hours > 0) {
    return minutes > 0 ? `${hours}h${minutes}m` : `${hours}h`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return `${Math.max(0, seconds)}s`;
}

export function getCurrentUser(): string {
  return process.env.USER || process.env.USERNAME || "unknown";
}

export function calculateDuration(startISO: string, endISO: string): string {
  const { hours, minutes, seconds } = getElapsedParts(startISO, new Date(endISO));

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(" ");
}

export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function isToday(isoString: string): boolean {
  const date = new Date(isoString);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

export function isThisWeek(isoString: string): boolean {
  const date = new Date(isoString);
  const today = new Date();

  // Get start of week (Monday)
  const startOfWeek = new Date(today);
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Sunday is 0, Monday is 1
  startOfWeek.setDate(today.getDate() + diff);
  startOfWeek.setHours(0, 0, 0, 0);

  // Get end of week (Sunday)
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return date >= startOfWeek && date <= endOfWeek;
}

export function isThisMonth(isoString: string): boolean {
  const date = new Date(isoString);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth()
  );
}

export function isThisYear(isoString: string): boolean {
  const date = new Date(isoString);
  const today = new Date();
  return date.getFullYear() === today.getFullYear();
}
