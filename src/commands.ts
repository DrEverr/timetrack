import {
  readEntries,
  addEntry,
  updateEntry,
  findActiveEntry,
  type TimeEntry,
} from "./csv";
import { formatElapsedTime, getCurrentUser, calculateDuration, formatDate, isToday, isThisWeek, isThisMonth, isThisYear } from "./utils";
import * as clack from "@clack/prompts";

export async function startTracking(title?: string, project?: string, watch?: number): Promise<void> {
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
    project: project || "",
    start: new Date().toISOString(),
    end: "",
  };

  await addEntry(entry);

  const titleMsg = title ? ` "${title}"` : "";
  const projectMsg = project ? ` [${project}]` : "";
  
  if (watch) {
    // Watch mode - show live timer after starting
    const interval = watch * 1000; // convert to milliseconds
    
    // Show started message briefly
    const s = clack.spinner();
    s.start(`Started tracking${titleMsg}${projectMsg}`);
    await new Promise(resolve => setTimeout(resolve, 800));
    s.stop(`Tracking${titleMsg}${projectMsg}`);
    
    // Clear screen and hide cursor
    process.stdout.write("\x1b[?25l"); // hide cursor
    
    const updateStatus = () => {
      const elapsed = formatElapsedTime(entry.start);
      const displayTitle = title ? `"${title}" - ` : "";
      const displayProject = project ? `[${project}] ` : "";
      
      // Clear screen
      process.stdout.write("\x1b[2J\x1b[H");
      
      console.log(`\n  ⏱  Tracking: ${displayProject}${displayTitle}${elapsed}`);
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
  
  clack.log.success(`Started tracking${titleMsg}${projectMsg}`);
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
        const projectMsg = active.entry.project
          ? `[${active.entry.project}] `
          : "";
        console.log(`\n  ⏱  Tracking: ${projectMsg}${titleMsg}${elapsed}`);
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
  const projectMsg = active.entry.project
    ? `[${active.entry.project}] `
    : "";
  clack.log.info(`Tracking: ${projectMsg}${titleMsg}${elapsed}`);
}

export type DateFilter = "day" | "week" | "month" | "year" | "all";

export async function listEntries(filter: DateFilter = "day", projectFilter?: string): Promise<void> {
  const allEntries = await readEntries();

  // Apply date filter
  let entries = allEntries;
  if (filter !== "all") {
    entries = entries.filter((entry) => {
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

  // Apply project filter
  if (projectFilter) {
    entries = entries.filter((entry) =>
      entry.project.toLowerCase() === projectFilter.toLowerCase()
    );
  }

  if (entries.length === 0) {
    const filterMsg = filter === "all" ? "all time" : `this ${filter}`;
    const projectMsg = projectFilter ? ` in project "${projectFilter}"` : "";
    clack.log.warn(`No time entries found for ${filterMsg}${projectMsg}`);
    return;
  }

  // Print header with clack
  const filterLabel = filter === "all" ? "All Entries" : `This ${filter.charAt(0).toUpperCase() + filter.slice(1)}`;
  const projectLabel = projectFilter ? ` - ${projectFilter}` : "";
  clack.intro(`Time Entries - ${filterLabel}${projectLabel}`);

  // Check if any entries have a project
  const hasProjects = entries.some((e) => e.project);

  // Calculate column widths
  const userWidth = Math.max(4, ...entries.map((e) => e.user.length));
  const titleWidth = Math.max(5, ...entries.map((e) => e.title.length));
  const projectWidth = hasProjects ? Math.max(7, ...entries.map((e) => e.project.length)) : 0;
  const dateWidth = 19; // "YYYY-MM-DD HH:MM:SS".length
  const durationWidth = 8;

  // Print header
  const headerParts = [
    "User".padEnd(userWidth),
    "Title".padEnd(titleWidth),
  ];
  if (hasProjects) {
    headerParts.push("Project".padEnd(projectWidth));
  }
  headerParts.push(
    "Start".padEnd(dateWidth),
    "End".padEnd(dateWidth),
    "Duration".padEnd(durationWidth),
  );
  const header = headerParts.join(" | ");

  const separator = "-".repeat(header.length);

  console.log(header);
  console.log(separator);

  // Print entries
  for (const entry of entries) {
    const rowParts = [
      entry.user.padEnd(userWidth),
      entry.title.padEnd(titleWidth),
    ];
    if (hasProjects) {
      rowParts.push(entry.project.padEnd(projectWidth));
    }
    rowParts.push(
      formatDate(entry.start).padEnd(dateWidth),
      entry.end ? formatDate(entry.end).padEnd(dateWidth) : "In progress".padEnd(dateWidth),
      entry.end
        ? calculateDuration(entry.start, entry.end).padEnd(durationWidth)
        : formatElapsedTime(entry.start).padEnd(durationWidth),
    );
    console.log(rowParts.join(" | "));
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
