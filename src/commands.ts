import {
  readEntries,
  addEntry,
  updateEntry,
  findActiveEntry,
  findLastCompletedEntry,
  type TimeEntry,
} from "./csv";
import { formatElapsedTime, getCurrentUser, calculateDuration, formatDate, isToday, isThisWeek, isThisMonth, isThisYear } from "./utils";

const c = {
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};

function setupKeyboardListener(callbacks: {
  onStop: () => void | Promise<void>;
  onQuit: () => void;
  onResume?: () => void | Promise<void>;
}): () => void {
  if (!process.stdin.isTTY) {
    return () => {};
  }

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  const onStdinData = (key: string) => {
    if (key === "s" || key === "S") {
      callbacks.onStop();
    } else if (key === "r" || key === "R") {
      callbacks.onResume?.();
    } else if (key === "\x03" || key === "q" || key === "Q") {
      // Ctrl+C or q
      callbacks.onQuit();
    }
  };

  process.stdin.on("data", onStdinData);

  return () => {
    process.stdin.removeListener("data", onStdinData);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }
  };
}

function cleanupWatch(timer: ReturnType<typeof setInterval>, cleanupKeyboard?: () => void): void {
  clearInterval(timer);
  if (cleanupKeyboard) {
    cleanupKeyboard();
  } else if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
    process.stdin.pause();
  }
  process.stdout.write("\x1b[?25h"); // show cursor
  process.stdout.write("\n");
}

export async function startTracking(title?: string, project?: string, watch?: number): Promise<void> {
  const entries = await readEntries();
  const active = findActiveEntry(entries);

  if (active) {
    const titleMsg = active.entry.title
      ? ` (${active.entry.title})`
      : "";
    console.error(c.red(`A timer is already running${titleMsg}`));
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

  console.log(c.green(`Started tracking${titleMsg}${projectMsg}`));

  if (watch) {
    // Watch mode - show live timer after starting
    await showStatus(watch);
  }
}

export async function stopTracking(): Promise<void> {
  const entries = await readEntries();
  const active = findActiveEntry(entries);

  if (!active) {
    console.error(c.red("No active timer to stop"));
    process.exit(1);
  }

  await updateEntry(active.index, { end: new Date().toISOString() });

  const elapsed = formatElapsedTime(active.entry.start);
  const titleMsg = active.entry.title ? ` "${active.entry.title}"` : "";
  console.log(c.yellow(`Stopped tracking${titleMsg} - ${elapsed}`));
}

export async function resumeTracking(watch?: number): Promise<void> {
  const entries = await readEntries();
  const active = findActiveEntry(entries);

  if (active) {
    const titleMsg = active.entry.title
      ? ` (${active.entry.title})`
      : "";
    console.error(c.red(`A timer is already running${titleMsg}`));
    process.exit(1);
  }

  const last = findLastCompletedEntry(entries);

  if (!last) {
    console.error(c.red("No previous timer to resume"));
    process.exit(1);
  }

  await startTracking(last.entry.title || undefined, last.entry.project || undefined, watch);
}

export async function showStatus(watch?: number): Promise<void> {
  if (watch) {
    // Watch mode - continuously update status
    const interval = watch * 1000; // convert to milliseconds

    // Hide cursor
    process.stdout.write("\x1b[?25l");

    let hasActiveTimer = false;
    let canResume = false;

    const updateStatus = async () => {
      const entries = await readEntries();
      const active = findActiveEntry(entries);
      hasActiveTimer = !!active;
      canResume = !active && !!findLastCompletedEntry(entries);

      if (!active) {
        const hints = canResume ? c.dim("  [r] resume  [q] quit") : c.dim("  [q] quit");
        process.stdout.write(`\r\x1b[K  \x1b[33m⏸  Nothing is being tracked\x1b[0m${hints}`);
      } else {
        const elapsed = formatElapsedTime(active.entry.start);
        const titleMsg = active.entry.title
          ? `"${active.entry.title}" - `
          : "";
        const projectMsg = active.entry.project
          ? `[${active.entry.project}] `
          : "";
        process.stdout.write(`\r\x1b[K  \x1b[36m⏱  Tracking: ${projectMsg}${titleMsg}\x1b[1m${elapsed}\x1b[0m  ${c.dim("[s] stop  [q] quit")}`);
      }
    };

    // Initial update
    await updateStatus();

    // Set up interval
    const timer = setInterval(updateStatus, interval);

    let cleanupKeyboard: (() => void) | undefined;

    const quit = () => {
      process.removeListener("SIGINT", quit);
      cleanupWatch(timer, cleanupKeyboard);
      process.exit(0);
    };

    const stop = async () => {
      if (!hasActiveTimer) return;
      const entries = await readEntries();
      const active = findActiveEntry(entries);
      if (!active) return;
      await updateEntry(active.index, { end: new Date().toISOString() });
      // Immediately refresh display
      await updateStatus();
    };

    const resume = async () => {
      if (hasActiveTimer || !canResume) return;
      const entries = await readEntries();
      const last = findLastCompletedEntry(entries);
      if (!last) return;
      const entry: TimeEntry = {
        user: getCurrentUser(),
        title: last.entry.title,
        project: last.entry.project,
        start: new Date().toISOString(),
        end: "",
      };
      await addEntry(entry);
      // Immediately refresh display
      await updateStatus();
    };

    cleanupKeyboard = setupKeyboardListener({ onStop: stop, onQuit: quit, onResume: resume });

    // Handle cleanup on exit
    process.once("SIGINT", quit);

    return;
  }

  // Normal single-shot status
  const entries = await readEntries();
  const active = findActiveEntry(entries);

  if (!active) {
    console.log(c.yellow("Nothing is being tracked"));
    return;
  }

  const elapsed = formatElapsedTime(active.entry.start);
  const titleMsg = active.entry.title
    ? `"${active.entry.title}" - `
    : "";
  const projectMsg = active.entry.project
    ? `[${active.entry.project}] `
    : "";
  console.log(c.cyan(`Tracking: ${projectMsg}${titleMsg}${elapsed}`));
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
    console.log(c.yellow(`No time entries found for ${filterMsg}${projectMsg}`));
    return;
  }

  const filterLabel = filter === "all" ? "All Entries" : `This ${filter.charAt(0).toUpperCase() + filter.slice(1)}`;
  const projectLabel = projectFilter ? ` - ${projectFilter}` : "";
  console.log(c.bold(`\nTime Entries - ${filterLabel}${projectLabel}\n`));

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

  console.log(c.dim(header));
  console.log(c.dim(separator));

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
      entry.end ? formatDate(entry.end).padEnd(dateWidth) : c.cyan("In progress".padEnd(dateWidth)),
      entry.end
        ? calculateDuration(entry.start, entry.end).padEnd(durationWidth)
        : formatElapsedTime(entry.start).padEnd(durationWidth),
    );
    console.log(rowParts.join(" | "));
  }

  // Print summary
  console.log(c.dim(separator));
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

  console.log(c.bold(`\nTotal: ${entries.length} entries, ${completedEntries.length} completed, ${parts.join(" ")} tracked`));
}
