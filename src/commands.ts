import {
  readEntries,
  addEntry,
  updateEntry,
  findActiveEntry,
  type TimeEntry,
} from "./csv";
import { formatElapsedTime, getCurrentUser, calculateDuration, formatDate, isToday, isThisWeek, isThisMonth, isThisYear } from "./utils";
import * as clack from "@clack/prompts";

export async function startTracking(title?: string, watch?: number): Promise<void> {
  const entries = await readEntries();
  const active = findActiveEntry(entries);

  if (active) {
    const titleMsg = active.entry.title
      ? ` (${active.entry.title})`
      : "";
    clack.cancel(`A timer is already running${titleMsg}`);
    process.exit(1);
  }

  const entry: TimeEntry = {
    user: getCurrentUser(),
    title: title || "",
    start: new Date().toISOString(),
    end: "",
  };

  await addEntry(entry);

  const titleMsg = title ? ` "${title}"` : "";
  
  if (watch) {
    // Watch mode - show live timer after starting
    const interval = watch * 1000; // convert to milliseconds
    
    // Show started message briefly
    const s = clack.spinner();
    s.start(`Started tracking${titleMsg}`);
    await new Promise(resolve => setTimeout(resolve, 800));
    s.stop(`Tracking${titleMsg}`);
    
    // Clear screen and hide cursor
    process.stdout.write("\x1b[?25l"); // hide cursor
    
    const updateStatus = () => {
      const elapsed = formatElapsedTime(entry.start);
      const displayTitle = title ? `"${title}" - ` : "";
      
      // Clear screen
      process.stdout.write("\x1b[2J\x1b[H");
      
      console.log(`\n  ⏱  Tracking: ${displayTitle}${elapsed}`);
      console.log(`\n  Press Ctrl+C to exit`);
    };
    
    // Initial update
    updateStatus();
    
    // Set up interval
    const timer = setInterval(updateStatus, interval);
    
    // Handle cleanup on exit
    process.on("SIGINT", () => {
      clearInterval(timer);
      process.stdout.write("\x1b[?25h"); // show cursor
      process.stdout.write("\n");
      process.exit(0);
    });
    
    return;
  }
  
  clack.log.success(`Started tracking${titleMsg}`);
}

export async function stopTracking(): Promise<void> {
  const entries = await readEntries();
  const active = findActiveEntry(entries);

  if (!active) {
    clack.cancel("No active timer to stop");
    process.exit(1);
  }

  await updateEntry(active.index, { end: new Date().toISOString() });

  const elapsed = formatElapsedTime(active.entry.start);
  const titleMsg = active.entry.title ? ` "${active.entry.title}"` : "";
  clack.log.info(`Stopped tracking${titleMsg} - ${elapsed}`);
}

export async function showStatus(watch?: number): Promise<void> {
  if (watch) {
    // Watch mode - continuously update status
    const interval = watch * 1000; // convert to milliseconds
    
    // Clear screen and hide cursor
    process.stdout.write("\x1b[?25l"); // hide cursor
    
    const updateStatus = async () => {
      const entries = await readEntries();
      const active = findActiveEntry(entries);
      
      // Clear screen
      process.stdout.write("\x1b[2J\x1b[H");
      
      if (!active) {
        console.log("\n  ⏸  Nothing is being tracked");
      } else {
        const elapsed = formatElapsedTime(active.entry.start);
        const titleMsg = active.entry.title
          ? `"${active.entry.title}" - `
          : "";
        console.log(`\n  ⏱  Tracking: ${titleMsg}${elapsed}`);
      }
      
      console.log(`\n  Press Ctrl+C to exit`);
    };
    
    // Initial update
    await updateStatus();
    
    // Set up interval
    const timer = setInterval(updateStatus, interval);
    
    // Handle cleanup on exit
    process.on("SIGINT", () => {
      clearInterval(timer);
      process.stdout.write("\x1b[?25h"); // show cursor
      process.stdout.write("\n");
      process.exit(0);
    });
    
    return;
  }
  
  // Normal single-shot status
  const entries = await readEntries();
  const active = findActiveEntry(entries);

  if (!active) {
    clack.log.warn("Nothing is being tracked");
    return;
  }

  const elapsed = formatElapsedTime(active.entry.start);
  const titleMsg = active.entry.title
    ? `"${active.entry.title}" - `
    : "";
  clack.log.info(`Tracking: ${titleMsg}${elapsed}`);
}

export type DateFilter = "day" | "week" | "month" | "year" | "all";

export async function listEntries(filter: DateFilter = "day"): Promise<void> {
  const allEntries = await readEntries();

  // Apply date filter
  let entries = allEntries;
  if (filter !== "all") {
    entries = allEntries.filter((entry) => {
      switch (filter) {
        case "day":
          return isToday(entry.start);
        case "week":
          return isThisWeek(entry.start);
        case "month":
          return isThisMonth(entry.start);
        case "year":
          return isThisYear(entry.start);
        default:
          return true;
      }
    });
  }

  if (entries.length === 0) {
    clack.log.warn(`No time entries found for ${filter === "all" ? "all time" : `this ${filter}`}`);
    return;
  }

  // Print header with clack
  const filterLabel = filter === "all" ? "All Entries" : `This ${filter.charAt(0).toUpperCase() + filter.slice(1)}`;
  clack.intro(`Time Entries - ${filterLabel}`);

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

  clack.outro(`Total: ${entries.length} entries, ${completedEntries.length} completed, ${parts.join(" ")} tracked`);
}
