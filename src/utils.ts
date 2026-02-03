export function formatElapsedTime(startISO: string): string {
  const start = new Date(startISO);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  const hrs = hours;
  const mins = minutes % 60;
  const secs = seconds % 60;

  const parts: string[] = [];
  if (hrs > 0) parts.push(`${hrs}h`);
  if (mins > 0) parts.push(`${mins}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(" ");
}

export function getCurrentUser(): string {
  return process.env.USER || process.env.USERNAME || "unknown";
}

export function calculateDuration(startISO: string, endISO: string): string {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const diffMs = end.getTime() - start.getTime();

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  const hrs = hours;
  const mins = minutes % 60;
  const secs = seconds % 60;

  const parts: string[] = [];
  if (hrs > 0) parts.push(`${hrs}h`);
  if (mins > 0) parts.push(`${mins}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

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
