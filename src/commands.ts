import {
  readEntries,
  addEntry,
  updateEntry,
  findActiveEntry,
  type TimeEntry,
} from "./csv";
import { formatElapsedTime, getCurrentUser, calculateDuration, formatDate } from "./utils";

export async function startTracking(title?: string): Promise<void> {
  const entries = await readEntries();
  const active = findActiveEntry(entries);

  if (active) {
    const titleMsg = active.entry.title
      ? ` (${active.entry.title})`
      : "";
    console.log(`A timer is already running${titleMsg}`);
    process.exit(1);
  }

  const entry: TimeEntry = {
    user: getCurrentUser(),
    title: title || "",
    start: new Date().toISOString(),
    end: "",
  };

  await addEntry(entry);

  const titleMsg = title ? ` for "${title}"` : "";
  console.log(`Started tracking${titleMsg}`);
}

export async function stopTracking(): Promise<void> {
  const entries = await readEntries();
  const active = findActiveEntry(entries);

  if (!active) {
    console.log("No active timer to stop");
    process.exit(1);
  }

  await updateEntry(active.index, { end: new Date().toISOString() });

  const elapsed = formatElapsedTime(active.entry.start);
  const titleMsg = active.entry.title ? ` "${active.entry.title}"` : "";
  console.log(`Stopped tracking${titleMsg} (${elapsed})`);
}

export async function showStatus(): Promise<void> {
  const entries = await readEntries();
  const active = findActiveEntry(entries);

  if (!active) {
    console.log("Nothing is being tracked");
    return;
  }

  const elapsed = formatElapsedTime(active.entry.start);
  const titleMsg = active.entry.title
    ? `"${active.entry.title}" - `
    : "";
  console.log(`Tracking: ${titleMsg}${elapsed}`);
}

export async function listEntries(): Promise<void> {
  const entries = await readEntries();

  if (entries.length === 0) {
    console.log("No time entries found");
    return;
  }

  // Calculate column widths
  const userWidth = Math.max(4, ...entries.map((e) => e.user.length));
  const titleWidth = Math.max(5, ...entries.map((e) => e.title.length));
  const dateWidth = 19; // "YYYY-MM-DD HH:MM:SS".length
  const durationWidth = 8;

  // Print header
  const header = [
    "User".padEnd(userWidth),
    "Title".padEnd(titleWidth),
    "Start".padEnd(dateWidth),
    "End".padEnd(dateWidth),
    "Duration".padEnd(durationWidth),
  ].join(" | ");

  const separator = "-".repeat(header.length);

  console.log(header);
  console.log(separator);

  // Print entries
  for (const entry of entries) {
    const user = entry.user.padEnd(userWidth);
    const title = entry.title.padEnd(titleWidth);
    const start = formatDate(entry.start).padEnd(dateWidth);
    const end = entry.end ? formatDate(entry.end).padEnd(dateWidth) : "In progress".padEnd(dateWidth);
    const duration = entry.end
      ? calculateDuration(entry.start, entry.end).padEnd(durationWidth)
      : formatElapsedTime(entry.start).padEnd(durationWidth);

    const row = [user, title, start, end, duration].join(" | ");
    console.log(row);
  }

  // Print summary
  console.log(separator);
  const completedEntries = entries.filter((e) => e.end);
  let totalMs = 0;
  for (const entry of completedEntries) {
    const start = new Date(entry.start);
    const end = new Date(entry.end);
    totalMs += end.getTime() - start.getTime();
  }

  const totalSeconds = Math.floor(totalMs / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);

  const hrs = totalHours;
  const mins = totalMinutes % 60;

  const parts: string[] = [];
  if (hrs > 0) parts.push(`${hrs}h`);
  if (mins > 0) parts.push(`${mins}m`);
  if (parts.length === 0) parts.push("0m");

  console.log(`Total: ${entries.length} entries, ${completedEntries.length} completed, ${parts.join(" ")} tracked`);
}
