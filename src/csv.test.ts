import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  readEntries,
  writeEntries,
  addEntry,
  updateEntry,
  findActiveEntry,
  type TimeEntry,
} from "./csv";

let tempDir: string;
let originalCwd: string;

beforeEach(() => {
  originalCwd = process.cwd();
  tempDir = mkdtempSync(join(tmpdir(), "timetrack-test-"));
  process.chdir(tempDir);
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(tempDir, { recursive: true, force: true });
});

const sampleEntry: TimeEntry = {
  user: "testuser",
  title: "Test task",
  project: "",
  start: "2025-01-15T10:00:00.000Z",
  end: "2025-01-15T11:30:00.000Z",
};

describe("readEntries", () => {
  it("should return empty array when file does not exist", async () => {
    const entries = await readEntries();
    expect(entries).toEqual([]);
  });

  it("should return empty array when file only has header", async () => {
    writeFileSync(join(tempDir, "timetrack.csv"), "user,title,project,start,end\n");
    const entries = await readEntries();
    expect(entries).toEqual([]);
  });

  it("should parse entries from CSV file", async () => {
    const csv = `user,title,project,start,end
testuser,Test task,,2025-01-15T10:00:00.000Z,2025-01-15T11:30:00.000Z`;
    writeFileSync(join(tempDir, "timetrack.csv"), csv);

    const entries = await readEntries();
    expect(entries).toEqual([sampleEntry]);
  });

  it("should parse multiple entries", async () => {
    const csv = `user,title,project,start,end
user1,Task 1,,2025-01-15T10:00:00.000Z,2025-01-15T11:00:00.000Z
user2,Task 2,,2025-01-15T12:00:00.000Z,2025-01-15T13:00:00.000Z`;
    writeFileSync(join(tempDir, "timetrack.csv"), csv);

    const entries = await readEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0]!.user).toBe("user1");
    expect(entries[0]!.title).toBe("Task 1");
    expect(entries[1]!.user).toBe("user2");
    expect(entries[1]!.title).toBe("Task 2");
  });

  it("should handle entries with empty end (active timer)", async () => {
    const csv = `user,title,project,start,end
testuser,Active task,,,`;
    writeFileSync(join(tempDir, "timetrack.csv"), csv);

    const entries = await readEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.end).toBe("");
  });

  it("should handle quoted fields with commas", async () => {
    const csv = `user,title,project,start,end
testuser,"Task with, comma",,2025-01-15T10:00:00.000Z,2025-01-15T11:00:00.000Z`;
    writeFileSync(join(tempDir, "timetrack.csv"), csv);

    const entries = await readEntries();
    expect(entries[0]!.title).toBe("Task with, comma");
  });

  it("should handle quoted fields with escaped quotes", async () => {
    const csv = `user,title,project,start,end
testuser,"Task with ""quotes""",,2025-01-15T10:00:00.000Z,2025-01-15T11:00:00.000Z`;
    writeFileSync(join(tempDir, "timetrack.csv"), csv);

    const entries = await readEntries();
    expect(entries[0]!.title).toBe('Task with "quotes"');
  });

  it("should return empty array for empty file content", async () => {
    writeFileSync(join(tempDir, "timetrack.csv"), "");
    const entries = await readEntries();
    expect(entries).toEqual([]);
  });

  it("should read legacy 4-column CSV format with backward compatibility", async () => {
    const csv = `user,title,start,end
testuser,Legacy task,2025-01-15T10:00:00.000Z,2025-01-15T11:00:00.000Z`;
    writeFileSync(join(tempDir, "timetrack.csv"), csv);

    const entries = await readEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.user).toBe("testuser");
    expect(entries[0]!.title).toBe("Legacy task");
    expect(entries[0]!.project).toBe("");
    expect(entries[0]!.start).toBe("2025-01-15T10:00:00.000Z");
    expect(entries[0]!.end).toBe("2025-01-15T11:00:00.000Z");
  });
});

describe("writeEntries", () => {
  it("should write entries with header to CSV", async () => {
    await writeEntries([sampleEntry]);

    const content = readFileSync(join(tempDir, "timetrack.csv"), "utf-8");
    const lines = content.trim().split("\n");
    expect(lines[0]).toBe("user,title,project,start,end");
    expect(lines[1]).toBe(
      "testuser,Test task,,2025-01-15T10:00:00.000Z,2025-01-15T11:30:00.000Z"
    );
  });

  it("should write empty entries with just header", async () => {
    await writeEntries([]);

    const content = readFileSync(join(tempDir, "timetrack.csv"), "utf-8");
    expect(content.trim()).toBe("user,title,project,start,end");
  });

  it("should escape fields with commas", async () => {
    const entry: TimeEntry = {
      user: "testuser",
      title: "Task, with comma",
      project: "",
      start: "2025-01-15T10:00:00.000Z",
      end: "2025-01-15T11:00:00.000Z",
    };
    await writeEntries([entry]);

    const content = readFileSync(join(tempDir, "timetrack.csv"), "utf-8");
    expect(content).toContain('"Task, with comma"');
  });

  it("should escape fields with double quotes", async () => {
    const entry: TimeEntry = {
      user: "testuser",
      title: 'Task "important"',
      project: "",
      start: "2025-01-15T10:00:00.000Z",
      end: "2025-01-15T11:00:00.000Z",
    };
    await writeEntries([entry]);

    const content = readFileSync(join(tempDir, "timetrack.csv"), "utf-8");
    expect(content).toContain('"Task ""important"""');
  });

  it("should escape fields with newlines", async () => {
    const entry: TimeEntry = {
      user: "testuser",
      title: "Task\nwith newline",
      project: "",
      start: "2025-01-15T10:00:00.000Z",
      end: "2025-01-15T11:00:00.000Z",
    };
    await writeEntries([entry]);

    const content = readFileSync(join(tempDir, "timetrack.csv"), "utf-8");
    expect(content).toContain('"Task\nwith newline"');
  });

  it("should not escape fields without special characters", async () => {
    await writeEntries([sampleEntry]);

    const content = readFileSync(join(tempDir, "timetrack.csv"), "utf-8");
    const lines = content.trim().split("\n");
    // user and title fields should NOT be quoted
    expect(lines[1]).toStartWith("testuser,Test task,");
  });

  it("should write multiple entries", async () => {
    const entries: TimeEntry[] = [
      { user: "a", title: "T1", project: "", start: "2025-01-01T00:00:00Z", end: "2025-01-01T01:00:00Z" },
      { user: "b", title: "T2", project: "", start: "2025-01-02T00:00:00Z", end: "2025-01-02T01:00:00Z" },
    ];
    await writeEntries(entries);

    const content = readFileSync(join(tempDir, "timetrack.csv"), "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(3); // header + 2 entries
  });

  it("should write project field correctly", async () => {
    const entry: TimeEntry = {
      user: "testuser",
      title: "Task",
      project: "myproject",
      start: "2025-01-15T10:00:00.000Z",
      end: "2025-01-15T11:00:00.000Z",
    };
    await writeEntries([entry]);

    const content = readFileSync(join(tempDir, "timetrack.csv"), "utf-8");
    const lines = content.trim().split("\n");
    expect(lines[1]).toBe(
      "testuser,Task,myproject,2025-01-15T10:00:00.000Z,2025-01-15T11:00:00.000Z"
    );
  });

  it("should escape project field with special characters", async () => {
    const entry: TimeEntry = {
      user: "testuser",
      title: "Task",
      project: "my, project",
      start: "2025-01-15T10:00:00.000Z",
      end: "2025-01-15T11:00:00.000Z",
    };
    await writeEntries([entry]);

    const content = readFileSync(join(tempDir, "timetrack.csv"), "utf-8");
    expect(content).toContain('"my, project"');
  });
});

describe("addEntry", () => {
  it("should create file and add entry when file does not exist", async () => {
    await addEntry(sampleEntry);

    const entries = await readEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(sampleEntry);
  });

  it("should append entry to existing entries", async () => {
    await addEntry(sampleEntry);

    const newEntry: TimeEntry = {
      user: "testuser",
      title: "Second task",
      project: "",
      start: "2025-01-15T12:00:00.000Z",
      end: "2025-01-15T13:00:00.000Z",
    };
    await addEntry(newEntry);

    const entries = await readEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual(sampleEntry);
    expect(entries[1]).toEqual(newEntry);
  });
});

describe("updateEntry", () => {
  it("should update an entry at a given index", async () => {
    await addEntry({
      user: "testuser",
      title: "Active",
      project: "",
      start: "2025-01-15T10:00:00.000Z",
      end: "",
    });

    await updateEntry(0, { end: "2025-01-15T11:00:00.000Z" });

    const entries = await readEntries();
    expect(entries[0]!.end).toBe("2025-01-15T11:00:00.000Z");
  });

  it("should preserve other fields when partially updating", async () => {
    await addEntry(sampleEntry);

    await updateEntry(0, { title: "Updated title" });

    const entries = await readEntries();
    expect(entries[0]!.title).toBe("Updated title");
    expect(entries[0]!.user).toBe("testuser");
    expect(entries[0]!.start).toBe("2025-01-15T10:00:00.000Z");
    expect(entries[0]!.end).toBe("2025-01-15T11:30:00.000Z");
  });

  it("should do nothing when index is out of bounds (negative)", async () => {
    await addEntry(sampleEntry);

    await updateEntry(-1, { title: "Should not update" });

    const entries = await readEntries();
    expect(entries[0]!.title).toBe("Test task");
  });

  it("should do nothing when index is out of bounds (too large)", async () => {
    await addEntry(sampleEntry);

    await updateEntry(5, { title: "Should not update" });

    const entries = await readEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.title).toBe("Test task");
  });

  it("should update the correct entry when multiple exist", async () => {
    await addEntry({ user: "a", title: "T1", project: "", start: "s1", end: "e1" });
    await addEntry({ user: "b", title: "T2", project: "", start: "s2", end: "e2" });
    await addEntry({ user: "c", title: "T3", project: "", start: "s3", end: "e3" });

    await updateEntry(1, { title: "Updated T2" });

    const entries = await readEntries();
    expect(entries[0]!.title).toBe("T1");
    expect(entries[1]!.title).toBe("Updated T2");
    expect(entries[2]!.title).toBe("T3");
  });

  it("should update the project field", async () => {
    await addEntry({ user: "a", title: "T1", project: "", start: "s1", end: "e1" });

    await updateEntry(0, { project: "newproject" });

    const entries = await readEntries();
    expect(entries[0]!.project).toBe("newproject");
  });
});

describe("findActiveEntry", () => {
  it("should return null when no entries", () => {
    const result = findActiveEntry([]);
    expect(result).toBeNull();
  });

  it("should return null when all entries are completed", () => {
    const entries: TimeEntry[] = [
      { user: "a", title: "T1", project: "", start: "s1", end: "e1" },
      { user: "b", title: "T2", project: "", start: "s2", end: "e2" },
    ];
    const result = findActiveEntry(entries);
    expect(result).toBeNull();
  });

  it("should find the active entry (empty end)", () => {
    const entries: TimeEntry[] = [
      { user: "a", title: "T1", project: "", start: "s1", end: "e1" },
      { user: "b", title: "Active", project: "", start: "s2", end: "" },
    ];
    const result = findActiveEntry(entries);
    expect(result).not.toBeNull();
    expect(result!.entry.title).toBe("Active");
    expect(result!.index).toBe(1);
  });

  it("should return the last active entry when multiple are active", () => {
    const entries: TimeEntry[] = [
      { user: "a", title: "Active 1", project: "", start: "s1", end: "" },
      { user: "b", title: "Completed", project: "", start: "s2", end: "e2" },
      { user: "c", title: "Active 2", project: "", start: "s3", end: "" },
    ];
    const result = findActiveEntry(entries);
    expect(result).not.toBeNull();
    expect(result!.entry.title).toBe("Active 2");
    expect(result!.index).toBe(2);
  });

  it("should find active entry at the beginning", () => {
    const entries: TimeEntry[] = [
      { user: "a", title: "Active", project: "", start: "s1", end: "" },
      { user: "b", title: "Done", project: "", start: "s2", end: "e2" },
    ];
    const result = findActiveEntry(entries);
    expect(result).not.toBeNull();
    expect(result!.index).toBe(0);
  });

  it("should find single active entry", () => {
    const entries: TimeEntry[] = [
      { user: "a", title: "Active", project: "", start: "s1", end: "" },
    ];
    const result = findActiveEntry(entries);
    expect(result).not.toBeNull();
    expect(result!.entry.title).toBe("Active");
    expect(result!.index).toBe(0);
  });
});

describe("CSV round-trip (write then read)", () => {
  it("should correctly round-trip entries with special characters", async () => {
    const entries: TimeEntry[] = [
      {
        user: "user,with,commas",
        title: 'Title with "quotes"',
        project: "",
        start: "2025-01-15T10:00:00.000Z",
        end: "2025-01-15T11:00:00.000Z",
      },
    ];

    await writeEntries(entries);
    const readBack = await readEntries();

    expect(readBack).toHaveLength(1);
    expect(readBack[0]!.user).toBe("user,with,commas");
    expect(readBack[0]!.title).toBe('Title with "quotes"');
  });

  it("should round-trip entries with empty fields", async () => {
    const entries: TimeEntry[] = [
      {
        user: "testuser",
        title: "",
        project: "",
        start: "2025-01-15T10:00:00.000Z",
        end: "",
      },
    ];

    await writeEntries(entries);
    const readBack = await readEntries();

    expect(readBack).toHaveLength(1);
    expect(readBack[0]!.title).toBe("");
    expect(readBack[0]!.end).toBe("");
  });

  it("should round-trip multiple entries", async () => {
    const entries: TimeEntry[] = [
      { user: "a", title: "Task 1", project: "", start: "2025-01-01T00:00:00Z", end: "2025-01-01T01:00:00Z" },
      { user: "b", title: "Task 2", project: "proj", start: "2025-01-02T00:00:00Z", end: "" },
      { user: "c", title: "Task, 3", project: "", start: "2025-01-03T00:00:00Z", end: "2025-01-03T02:00:00Z" },
    ];

    await writeEntries(entries);
    const readBack = await readEntries();

    expect(readBack).toHaveLength(3);
    expect(readBack[0]).toEqual(entries[0]);
    expect(readBack[1]).toEqual(entries[1]);
    expect(readBack[2]).toEqual(entries[2]);
  });

  it("should round-trip entries with project field", async () => {
    const entries: TimeEntry[] = [
      {
        user: "testuser",
        title: "Task",
        project: "my-project",
        start: "2025-01-15T10:00:00.000Z",
        end: "2025-01-15T11:00:00.000Z",
      },
    ];

    await writeEntries(entries);
    const readBack = await readEntries();

    expect(readBack).toHaveLength(1);
    expect(readBack[0]!.project).toBe("my-project");
  });

  it("should round-trip entries with project containing special characters", async () => {
    const entries: TimeEntry[] = [
      {
        user: "testuser",
        title: "Task",
        project: 'project, "special"',
        start: "2025-01-15T10:00:00.000Z",
        end: "2025-01-15T11:00:00.000Z",
      },
    ];

    await writeEntries(entries);
    const readBack = await readEntries();

    expect(readBack).toHaveLength(1);
    expect(readBack[0]!.project).toBe('project, "special"');
  });
});
