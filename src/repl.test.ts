import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { readEntriesAt, writeEntriesAt, type TimeEntry } from "./csv";
import { dispatchReplLine, parseCdTarget, promptFor, type ReplIO, type ReplSession } from "./repl";

let tempDir: string;
let session: ReplSession;
let output: string[];
let errors: string[];
const entrypoint = join(import.meta.dir, "index.ts");

const startedEntry: TimeEntry = {
  user: "testuser",
  title: "",
  project: "",
  start: "2026-07-14T10:00:00.000Z",
  end: "",
};

const io: ReplIO = {
  write: (message) => output.push(message),
  error: (message) => errors.push(message),
};

beforeEach(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "timetrack-repl-test-"));
  await writeEntriesAt(tempDir, [startedEntry]);
  session = {
    baseDir: tempDir,
    cwd: tempDir,
    entryIndex: 0,
    entry: startedEntry,
  };
  output = [];
  errors = [];
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

async function waitForEntryEnd(timeoutMs = 2000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const entries = await readEntriesAt(tempDir);
    if (entries[0]?.end) {
      return entries[0].end;
    }
    await Bun.sleep(25);
  }
  return "";
}

async function waitForEntry(timeoutMs = 2000): Promise<TimeEntry | undefined> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const entries = await readEntriesAt(tempDir);
    if (entries[0]) {
      return entries[0];
    }
    await Bun.sleep(25);
  }
  return undefined;
}

async function waitForText(getText: () => string, text: string, timeoutMs = 2000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (getText().includes(text)) {
      return true;
    }
    await Bun.sleep(25);
  }
  return false;
}

describe("parseCdTarget", () => {
  it("should parse cd with a relative path", () => {
    expect(parseCdTarget("cd src", "/work")).toBe("/work/src");
  });

  it("should ignore non-cd commands", () => {
    expect(parseCdTarget("echo cd src", "/work")).toBeNull();
  });

  it("should parse cd - using the previous cwd", () => {
    expect(parseCdTarget("cd -", "/work/src", "/work")).toBe("/work");
  });
});

describe("dispatchReplLine", () => {
  it("should update the tracked name", async () => {
    const result = await dispatchReplLine("/name Build export", session, io);
    const entries = await readEntriesAt(tempDir);

    expect(result).toBe("continue");
    expect(session.entry.title).toBe("Build export");
    expect(entries[0]!.title).toBe("Build export");
    expect(output[0]).toBe("Name: Build export");
  });

  it("should update the tracked project", async () => {
    await dispatchReplLine("/project cli", session, io);
    const entries = await readEntriesAt(tempDir);

    expect(session.entry.project).toBe("cli");
    expect(entries[0]!.project).toBe("cli");
  });

  it("should request quit for /quit", async () => {
    const result = await dispatchReplLine("/quit", session, io);
    expect(result).toBe("quit");
  });

  it("should change the session cwd for cd commands", async () => {
    const subdir = join(tempDir, "subdir");
    mkdirSync(subdir);

    await dispatchReplLine("cd subdir", session, io);

    expect(session.cwd).toBe(subdir);
    expect(session.previousCwd).toBe(tempDir);
  });

  it("should switch back to the previous cwd for cd -", async () => {
    const subdir = join(tempDir, "subdir");
    mkdirSync(subdir);

    await dispatchReplLine("cd subdir", session, io);
    await dispatchReplLine("cd -", session, io);

    expect(session.cwd).toBe(tempDir);
  });

  it("should run non-slash lines in the shell", async () => {
    const calls: Array<{ command: string; cwd: string }> = [];

    await dispatchReplLine("echo hello", session, io, async (command, cwd) => {
      calls.push({ command, cwd });
      return 0;
    });

    expect(calls).toEqual([{ command: "echo hello", cwd: tempDir }]);
  });
});

describe("promptFor", () => {
  it("should show dot for the base directory", () => {
    expect(promptFor(session)).toContain("track .>");
  });

  it("should show the current relative directory after cd", () => {
    session.cwd = join(tempDir, "subdir");
    expect(promptFor(session)).toContain("track subdir>");
  });
});

describe("runRepl signals", () => {
  it("should finalize the active entry on process SIGINT", async () => {
    const proc = Bun.spawn(["bun", entrypoint], {
      cwd: tempDir,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, NO_COLOR: "1" },
    });
    let stdout = "";
    const reader = proc.stdout.getReader();
    const readStdout = (async () => {
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        stdout += decoder.decode(value, { stream: true });
      }
    })();

    const entry = await waitForEntry();
    if (!entry) {
      proc.kill("SIGTERM");
    }
    expect(entry).toBeDefined();
    expect(await waitForText(() => stdout, "track .>")).toBe(true);

    proc.kill("SIGINT");
    const exitCode = await proc.exited;
    await readStdout;
    const end = await waitForEntryEnd();

    expect(exitCode).toBe(0);
    expect(end).not.toBe("");
  });
});
