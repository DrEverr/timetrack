import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { readEntries, findActiveEntry, type TimeEntry } from "./csv";

let tempDir: string;
const srcDir = import.meta.dir;
const entrypoint = join(srcDir, "index.ts");

function todayNoon(): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "timetrack-cmd-test-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

async function runCLI(...args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn(["bun", entrypoint, ...args], {
    cwd: tempDir,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, NO_COLOR: "1" },
  });
  const exitCode = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  return { exitCode, stdout, stderr };
}

async function getEntries(): Promise<TimeEntry[]> {
  const originalCwd = process.cwd();
  process.chdir(tempDir);
  try {
    return await readEntries();
  } finally {
    process.chdir(originalCwd);
  }
}

describe("startTracking", () => {
  it("should create a new entry when no active timer exists", async () => {
    const { exitCode } = await runCLI("start", "My task");
    expect(exitCode).toBe(0);

    const entries = await getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.title).toBe("My task");
    expect(entries[0]!.end).toBe("");
    expect(entries[0]!.start).toBeTruthy();
  });

  it("should create entry without title", async () => {
    const { exitCode } = await runCLI("start");
    expect(exitCode).toBe(0);

    const entries = await getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.title).toBe("");
  });

  it("should exit with error when timer is already running", async () => {
    await runCLI("start", "First task");
    const { exitCode } = await runCLI("start", "Second task");
    expect(exitCode).toBe(1);
  });

  it("should show message about existing active timer", async () => {
    await runCLI("start", "Running task");
    const { stdout, stderr } = await runCLI("start");
    const output = stdout + stderr;
    expect(output).toContain("already running");
  });

  it("should show title of existing active timer in error", async () => {
    await runCLI("start", "Running task");
    const { stdout, stderr } = await runCLI("start");
    const output = stdout + stderr;
    expect(output).toContain("Running task");
  });

  it("should not show title in error when active timer has no title", async () => {
    await runCLI("start");
    const { stdout, stderr } = await runCLI("start");
    const output = stdout + stderr;
    expect(output).toContain("already running");
  });

  it("should set the current user on the entry", async () => {
    await runCLI("start", "Task");

    const entries = await getEntries();
    expect(entries[0]!.user).toBeTruthy();
  });

  it("should include started message in output", async () => {
    const { stdout, stderr } = await runCLI("start", "My Task");
    const output = stdout + stderr;
    expect(output).toContain("Started tracking");
  });

  it("should create entry with project when --project flag is used", async () => {
    const { exitCode } = await runCLI("start", "My task", "--project", "frontend");
    expect(exitCode).toBe(0);

    const entries = await getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.title).toBe("My task");
    expect(entries[0]!.project).toBe("frontend");
  });

  it("should create entry with project using -p shorthand", async () => {
    const { exitCode } = await runCLI("start", "My task", "-p", "backend");
    expect(exitCode).toBe(0);

    const entries = await getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.project).toBe("backend");
  });

  it("should create entry with empty project when no --project flag", async () => {
    await runCLI("start", "My task");

    const entries = await getEntries();
    expect(entries[0]!.project).toBe("");
  });

  it("should show project in started message", async () => {
    const { stdout, stderr } = await runCLI("start", "My task", "-p", "frontend");
    const output = stdout + stderr;
    expect(output).toContain("[frontend]");
  });
});

describe("stopTracking", () => {
  it("should stop an active timer", async () => {
    await runCLI("start", "My task");
    const { exitCode } = await runCLI("stop");
    expect(exitCode).toBe(0);

    const entries = await getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.end).toBeTruthy();
    expect(entries[0]!.end).not.toBe("");
  });

  it("should exit with error when no active timer", async () => {
    const { exitCode } = await runCLI("stop");
    expect(exitCode).toBe(1);
  });

  it("should show error message when no active timer", async () => {
    const { stdout, stderr } = await runCLI("stop");
    const output = stdout + stderr;
    expect(output).toContain("No active timer");
  });

  it("should include title in stop message when title exists", async () => {
    await runCLI("start", "Important task");
    const { stdout, stderr } = await runCLI("stop");
    const output = stdout + stderr;
    expect(output).toContain("Important task");
  });

  it("should display 'Stopped tracking' in output", async () => {
    await runCLI("start", "Task");
    const { stdout, stderr } = await runCLI("stop");
    const output = stdout + stderr;
    expect(output).toContain("Stopped tracking");
  });

  it("should stop only the active timer when multiple entries exist", async () => {
    const csv = `user,title,project,start,end
user1,Done task,,2025-01-15T10:00:00.000Z,2025-01-15T11:00:00.000Z
user1,Active task,,2025-01-15T12:00:00.000Z,`;
    writeFileSync(join(tempDir, "timetrack.csv"), csv);

    const { exitCode } = await runCLI("stop");
    expect(exitCode).toBe(0);

    const entries = await getEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0]!.end).toBe("2025-01-15T11:00:00.000Z");
    expect(entries[1]!.end).toBeTruthy();
    expect(entries[1]!.end).not.toBe("");
  });
});

describe("showStatus", () => {
  it("should show message when no active timer", async () => {
    const { exitCode, stdout, stderr } = await runCLI("status");
    expect(exitCode).toBe(0);
    const output = stdout + stderr;
    expect(output).toContain("Nothing is being tracked");
  });

  it("should show tracking info when active timer exists", async () => {
    await runCLI("start", "Active task");
    const { exitCode, stdout, stderr } = await runCLI("status");
    expect(exitCode).toBe(0);
    const output = stdout + stderr;
    expect(output).toContain("Tracking");
  });

  it("should include title in status when title exists", async () => {
    await runCLI("start", "My task");
    const { stdout, stderr } = await runCLI("status");
    const output = stdout + stderr;
    expect(output).toContain("My task");
  });

  it("should show elapsed time in status", async () => {
    await runCLI("start", "Task");
    const { stdout, stderr } = await runCLI("status");
    const output = stdout + stderr;
    // Should contain some time indication like "0s"
    expect(output).toMatch(/\d+[hms]/);
  });

  it("should show status without title info when no title", async () => {
    await runCLI("start");
    const { stdout, stderr } = await runCLI("status");
    const output = stdout + stderr;
    expect(output).toContain("Tracking:");
  });

  it("should show project in status when project exists", async () => {
    await runCLI("start", "My task", "-p", "frontend");
    const { stdout, stderr } = await runCLI("status");
    const output = stdout + stderr;
    expect(output).toContain("[frontend]");
  });
});

describe("listEntries", () => {
  it("should show warning when no entries exist for day filter", async () => {
    const { exitCode, stdout, stderr } = await runCLI("list");
    expect(exitCode).toBe(0);
    const output = stdout + stderr;
    expect(output).toContain("No time entries found");
  });

  it("should show correct filter label for 'all'", async () => {
    const { stdout, stderr } = await runCLI("list", "-a");
    const output = stdout + stderr;
    expect(output).toContain("all time");
  });

  it("should show correct filter label for 'week'", async () => {
    const { stdout, stderr } = await runCLI("list", "-w");
    const output = stdout + stderr;
    expect(output).toContain("this week");
  });

  it("should show correct filter label for 'month'", async () => {
    const { stdout, stderr } = await runCLI("list", "-m");
    const output = stdout + stderr;
    expect(output).toContain("this month");
  });

  it("should show correct filter label for 'year'", async () => {
    const { stdout, stderr } = await runCLI("list", "-y");
    const output = stdout + stderr;
    expect(output).toContain("this year");
  });

  it("should list entries for today", async () => {
    const noon = todayNoon();
    const end = new Date(noon.getTime() + 3600000);
    const csv = `user,title,project,start,end
testuser,Today task,,${noon.toISOString()},${end.toISOString()}`;
    writeFileSync(join(tempDir, "timetrack.csv"), csv);

    const { exitCode, stdout, stderr } = await runCLI("list", "-d");
    expect(exitCode).toBe(0);
    const output = stdout + stderr;
    expect(output).toContain("This Day");
    expect(output).toContain("Today task");
  });

  it("should filter out entries from other days when filter is 'day'", async () => {
    const csv = `user,title,project,start,end
testuser,Yesterday task,,2025-06-10T10:00:00.000Z,2025-06-10T11:00:00.000Z`;
    writeFileSync(join(tempDir, "timetrack.csv"), csv);

    const { stdout, stderr } = await runCLI("list", "-d");
    const output = stdout + stderr;
    expect(output).toContain("No time entries found");
  });

  it("should show all entries when filter is 'all'", async () => {
    const csv = `user,title,project,start,end
testuser,Old task,,2020-01-01T10:00:00.000Z,2020-01-01T11:00:00.000Z`;
    writeFileSync(join(tempDir, "timetrack.csv"), csv);

    const { stdout, stderr } = await runCLI("list", "-a");
    const output = stdout + stderr;
    expect(output).toContain("All Entries");
    expect(output).toContain("Old task");
  });

  it("should display 'In progress' for active entries", async () => {
    const noon = todayNoon();
    const csv = `user,title,project,start,end
testuser,Active task,,${noon.toISOString()},`;
    writeFileSync(join(tempDir, "timetrack.csv"), csv);

    const { stdout, stderr } = await runCLI("list", "-d");
    const output = stdout + stderr;
    expect(output).toContain("In progress");
  });

  it("should calculate total duration in summary", async () => {
    const noon = todayNoon();
    const t1Start = new Date(noon.getTime() - 7200000); // noon - 2h
    const t1End   = new Date(noon.getTime() - 3600000); // noon - 1h (1h duration)
    const t2Start = new Date(noon.getTime() - 1800000); // noon - 30m
    const t2End   = noon;                               // noon (30m duration)
    const csv = `user,title,project,start,end
testuser,Task 1,,${t1Start.toISOString()},${t1End.toISOString()}
testuser,Task 2,,${t2Start.toISOString()},${t2End.toISOString()}`;
    writeFileSync(join(tempDir, "timetrack.csv"), csv);

    const { stdout, stderr } = await runCLI("list", "-d");
    const output = stdout + stderr;
    expect(output).toContain("2 entries");
    expect(output).toContain("2 completed");
    expect(output).toContain("1h 30m");
  });

  it("should show 0m when total duration is less than a minute", async () => {
    const noon = todayNoon();
    const end = new Date(noon.getTime() + 10000); // +10s
    const csv = `user,title,project,start,end
testuser,Quick task,,${noon.toISOString()},${end.toISOString()}`;
    writeFileSync(join(tempDir, "timetrack.csv"), csv);

    const { stdout, stderr } = await runCLI("list", "-d");
    const output = stdout + stderr;
    expect(output).toContain("0m");
  });

  it("should display header with User and Title columns", async () => {
    const csv = `user,title,project,start,end
testuser,Task,,2025-06-15T10:00:00.000Z,2025-06-15T11:00:00.000Z`;
    writeFileSync(join(tempDir, "timetrack.csv"), csv);

    const { stdout, stderr } = await runCLI("list", "-a");
    const output = stdout + stderr;
    expect(output).toContain("User");
    expect(output).toContain("Title");
  });

  it("should display separator line in table", async () => {
    const csv = `user,title,project,start,end
testuser,Task,,2025-06-15T10:00:00.000Z,2025-06-15T11:00:00.000Z`;
    writeFileSync(join(tempDir, "timetrack.csv"), csv);

    const { stdout, stderr } = await runCLI("list", "-a");
    const output = stdout + stderr;
    expect(output).toMatch(/-{10,}/);
  });

  it("should list entries for this week", async () => {
    const noon = todayNoon();
    const end = new Date(noon.getTime() + 3600000);
    const csv = `user,title,project,start,end
testuser,This week task,,${noon.toISOString()},${end.toISOString()}`;
    writeFileSync(join(tempDir, "timetrack.csv"), csv);

    const { stdout, stderr } = await runCLI("list", "-w");
    const output = stdout + stderr;
    expect(output).toContain("This Week");
  });

  it("should list entries for this month", async () => {
    const noon = todayNoon();
    const end = new Date(noon.getTime() + 3600000);
    const csv = `user,title,project,start,end
testuser,This month task,,${noon.toISOString()},${end.toISOString()}`;
    writeFileSync(join(tempDir, "timetrack.csv"), csv);

    const { stdout, stderr } = await runCLI("list", "-m");
    const output = stdout + stderr;
    expect(output).toContain("This Month");
  });

  it("should list entries for this year", async () => {
    const noon = todayNoon();
    const end = new Date(noon.getTime() + 3600000);
    const csv = `user,title,project,start,end
testuser,This year task,,${noon.toISOString()},${end.toISOString()}`;
    writeFileSync(join(tempDir, "timetrack.csv"), csv);

    const { stdout, stderr } = await runCLI("list", "-y");
    const output = stdout + stderr;
    expect(output).toContain("This Year");
  });

  it("should show hours and minutes in total when applicable", async () => {
    const csv = `user,title,project,start,end
testuser,Long task,,2025-06-15T10:00:00.000Z,2025-06-15T11:30:00.000Z`;
    writeFileSync(join(tempDir, "timetrack.csv"), csv);

    const { stdout, stderr } = await runCLI("list", "-a");
    const output = stdout + stderr;
    expect(output).toContain("1h 30m");
  });

  it("should default to day filter when no flag specified", async () => {
    // No entries today = "No time entries found for this day"
    const { stdout, stderr } = await runCLI("list");
    const output = stdout + stderr;
    expect(output).toContain("this day");
  });

  it("should show Project column when entries have projects", async () => {
    const csv = `user,title,project,start,end
testuser,Task,frontend,2025-06-15T10:00:00.000Z,2025-06-15T11:00:00.000Z`;
    writeFileSync(join(tempDir, "timetrack.csv"), csv);

    const { stdout, stderr } = await runCLI("list", "-a");
    const output = stdout + stderr;
    expect(output).toContain("Project");
    expect(output).toContain("frontend");
  });

  it("should not show Project column when no entries have projects", async () => {
    const csv = `user,title,project,start,end
testuser,Task,,2025-06-15T10:00:00.000Z,2025-06-15T11:00:00.000Z`;
    writeFileSync(join(tempDir, "timetrack.csv"), csv);

    const { stdout, stderr } = await runCLI("list", "-a");
    const output = stdout + stderr;
    expect(output).not.toContain("Project");
  });

  it("should filter entries by project with --project flag", async () => {
    const csv = `user,title,project,start,end
testuser,Frontend task,frontend,2025-06-15T10:00:00.000Z,2025-06-15T11:00:00.000Z
testuser,Backend task,backend,2025-06-15T12:00:00.000Z,2025-06-15T13:00:00.000Z`;
    writeFileSync(join(tempDir, "timetrack.csv"), csv);

    const { stdout, stderr } = await runCLI("list", "-a", "-p", "frontend");
    const output = stdout + stderr;
    expect(output).toContain("Frontend task");
    expect(output).not.toContain("Backend task");
  });

  it("should filter entries by project case-insensitively", async () => {
    const csv = `user,title,project,start,end
testuser,Task,Frontend,2025-06-15T10:00:00.000Z,2025-06-15T11:00:00.000Z`;
    writeFileSync(join(tempDir, "timetrack.csv"), csv);

    const { stdout, stderr } = await runCLI("list", "-a", "-p", "frontend");
    const output = stdout + stderr;
    expect(output).toContain("Task");
  });

  it("should show project name in list header when filtering by project", async () => {
    const csv = `user,title,project,start,end
testuser,Task,frontend,2025-06-15T10:00:00.000Z,2025-06-15T11:00:00.000Z`;
    writeFileSync(join(tempDir, "timetrack.csv"), csv);

    const { stdout, stderr } = await runCLI("list", "-a", "-p", "frontend");
    const output = stdout + stderr;
    expect(output).toContain("frontend");
  });

  it("should show no entries message when project filter matches nothing", async () => {
    const csv = `user,title,project,start,end
testuser,Task,frontend,2025-06-15T10:00:00.000Z,2025-06-15T11:00:00.000Z`;
    writeFileSync(join(tempDir, "timetrack.csv"), csv);

    const { stdout, stderr } = await runCLI("list", "-a", "-p", "nonexistent");
    const output = stdout + stderr;
    expect(output).toContain("No time entries found");
    expect(output).toContain("nonexistent");
  });
});
