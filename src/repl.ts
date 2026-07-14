import { createInterface, type Interface } from "readline";
import { existsSync } from "fs";
import { homedir } from "os";
import { isAbsolute, relative, resolve } from "path";
import {
  addEntryAt,
  finalizeEntrySync,
  findActiveEntry,
  readEntriesAt,
  updateEntrySync,
  type TimeEntry,
} from "./csv";
import { listEntries } from "./commands";
import { formatElapsedCompact, formatElapsedTime, getCurrentUser } from "./utils";

type DispatchResult = "continue" | "quit";

export interface ReplSession {
  baseDir: string;
  cwd: string;
  previousCwd?: string;
  entryIndex: number;
  entry: TimeEntry;
}

export interface ReplIO {
  write(message: string): void;
  error(message: string): void;
}

export type ShellRunner = (command: string, cwd: string) => Promise<number>;

const consoleIO: ReplIO = {
  write: (message) => console.log(message),
  error: (message) => console.error(message),
};

function expandHome(path: string): string {
  if (path === "~") return homedir();
  if (path.startsWith("~/")) return resolve(homedir(), path.slice(2));
  return path;
}

export function parseCdTarget(command: string, cwd: string, previousCwd?: string): string | null {
  const trimmed = command.trim();
  if (trimmed !== "cd" && !trimmed.startsWith("cd ")) {
    return null;
  }

  const rawTarget = trimmed === "cd" ? "~" : trimmed.slice(3).trim();
  const unquoted = rawTarget.replace(/^(['"])(.*)\1$/, "$2");
  const target = unquoted === "-" && previousCwd ? previousCwd : expandHome(unquoted || "~");

  return isAbsolute(target) ? target : resolve(cwd, target);
}

async function defaultShellRunner(command: string, cwd: string): Promise<number> {
  const shell = process.env.SHELL || "/bin/sh";
  const proc = Bun.spawn([shell, "-c", command], {
    cwd,
    stdio: ["inherit", "inherit", "inherit"],
  });
  return await proc.exited;
}

async function withCwd<T>(cwd: string, fn: () => Promise<T>): Promise<T> {
  const originalCwd = process.cwd();
  process.chdir(cwd);
  try {
    return await fn();
  } finally {
    process.chdir(originalCwd);
  }
}

function printHelp(io: ReplIO): void {
  io.write([
    "Commands:",
    "  /name <title>       set or clear the tracked task title",
    "  /project <name>     set or clear the project",
    "  /status             show the current timer",
    "  /list               list today's entries for this session directory",
    "  /help               show this help",
    "  /quit               stop tracking and exit",
    "",
    "Any other line runs in your shell. cd changes the REPL working directory.",
  ].join("\n"));
}

function printStatus(session: ReplSession, io: ReplIO): void {
  const project = session.entry.project ? `[${session.entry.project}] ` : "";
  const title = session.entry.title ? `"${session.entry.title}" - ` : "";
  io.write(`Tracking: ${project}${title}${formatElapsedTime(session.entry.start)}`);
}

export async function dispatchReplLine(
  line: string,
  session: ReplSession,
  io: ReplIO = consoleIO,
  runShell: ShellRunner = defaultShellRunner,
): Promise<DispatchResult> {
  const trimmed = line.trim();

  if (!trimmed) {
    return "continue";
  }

  if (trimmed.startsWith("/")) {
    const [command = "", ...rest] = trimmed.slice(1).split(/\s+/);
    const value = rest.join(" ");

    switch (command) {
      case "name":
      case "title":
        session.entry = { ...session.entry, title: value };
        updateEntrySync(session.baseDir, session.entryIndex, { title: value });
        io.write(value ? `Name: ${value}` : "Name cleared");
        return "continue";

      case "project":
        session.entry = { ...session.entry, project: value };
        updateEntrySync(session.baseDir, session.entryIndex, { project: value });
        io.write(value ? `Project: ${value}` : "Project cleared");
        return "continue";

      case "status":
        printStatus(session, io);
        return "continue";

      case "list":
        await withCwd(session.baseDir, () => listEntries("day"));
        return "continue";

      case "help":
        printHelp(io);
        return "continue";

      case "quit":
      case "exit":
      case "q":
        return "quit";

      default:
        io.error(`Unknown command: /${command}`);
        return "continue";
    }
  }

  const cdTarget = parseCdTarget(line, session.cwd, session.previousCwd);
  if (cdTarget) {
    if (!existsSync(cdTarget)) {
      io.error(`cd: no such directory: ${cdTarget}`);
      return "continue";
    }

    const previousCwd = session.cwd;
    session.cwd = cdTarget;
    session.previousCwd = previousCwd;
    process.env.PWD = cdTarget;
    process.env.OLDPWD = previousCwd;
    return "continue";
  }

  await runShell(line, session.cwd);
  return "continue";
}

export function promptFor(session: ReplSession): string {
  const relativeCwd = relative(session.baseDir, session.cwd);
  const cwdLabel = !relativeCwd
    ? "."
    : relativeCwd.startsWith("..")
      ? session.cwd
      : relativeCwd;
  return `[${formatElapsedCompact(session.entry.start)}] track ${cwdLabel}> `;
}

function suspend(rl: Interface): void {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  rl.pause();
}

function resume(rl: Interface, session: ReplSession): void {
  rl.resume();
  rl.setPrompt(promptFor(session));
  rl.prompt();
}

export async function runRepl(options: { title?: string; project?: string } = {}): Promise<void> {
  const baseDir = process.cwd();
  const entries = await readEntriesAt(baseDir);
  const active = findActiveEntry(entries);

  let session: ReplSession;
  if (active) {
    session = {
      baseDir,
      cwd: baseDir,
      entryIndex: active.index,
      entry: active.entry,
    };
    console.log(`Attached to active timer${active.entry.title ? ` "${active.entry.title}"` : ""}`);
  } else {
    const entry: TimeEntry = {
      user: getCurrentUser(),
      title: options.title || "",
      project: options.project || "",
      start: new Date().toISOString(),
      end: "",
    };
    const entryIndex = await addEntryAt(baseDir, entry);
    session = { baseDir, cwd: baseDir, entryIndex, entry };
    const title = entry.title ? ` "${entry.title}"` : "";
    const project = entry.project ? ` [${entry.project}]` : "";
    console.log(`Started tracking${title}${project}`);
  }

  let finalized = false;
  const finalizeOnce = (end = new Date().toISOString()) => {
    if (finalized) return;
    finalized = true;
    finalizeEntrySync(session.entryIndex, end, session.baseDir);
  };

  let rl: Interface | undefined;
  const exitCleanly = () => {
    finalizeOnce();
    rl?.close();
    process.exit(0);
  };

  const onProcessSignal = () => {
    finalizeOnce();
    process.exit(0);
  };

  process.once("SIGHUP", onProcessSignal);
  process.once("SIGTERM", onProcessSignal);
  process.once("SIGINT", onProcessSignal);

  rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: process.stdin.isTTY,
  });

  rl.on("SIGINT", exitCleanly);
  rl.on("close", () => {
    finalizeOnce();
    process.removeListener("SIGHUP", onProcessSignal);
    process.removeListener("SIGTERM", onProcessSignal);
    process.removeListener("SIGINT", onProcessSignal);
  });

  rl.on("line", async (line) => {
    suspend(rl);
    try {
      const result = await dispatchReplLine(line, session);
      if (result === "quit") {
        exitCleanly();
        return;
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
    } finally {
      if (!finalized) {
        resume(rl, session);
      }
    }
  });

  printHelp(consoleIO);
  resume(rl, session);
}
