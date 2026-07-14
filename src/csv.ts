import { existsSync, readFileSync, writeFileSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";

export interface TimeEntry {
  user: string;
  title: string;
  project: string;
  start: string;
  end: string;
}

const CSV_FILENAME = "timetrack.csv";
const CSV_HEADER = "user,title,project,start,end";

export function getCsvPath(baseDir = process.cwd()): string {
  return join(baseDir, CSV_FILENAME);
}

export async function readEntries(): Promise<TimeEntry[]> {
  return readEntriesAt(process.cwd());
}

export async function readEntriesAt(baseDir: string): Promise<TimeEntry[]> {
  const csvPath = getCsvPath(baseDir);

  if (!existsSync(csvPath)) {
    return [];
  }

  const content = await readFile(csvPath, "utf-8");
  return parseCSVContent(content);
}

export function readEntriesSync(baseDir = process.cwd()): TimeEntry[] {
  const csvPath = getCsvPath(baseDir);

  if (!existsSync(csvPath)) {
    return [];
  }

  const content = readFileSync(csvPath, "utf-8");
  return parseCSVContent(content);
}

function parseCSVContent(content: string): TimeEntry[] {
  const lines = content.trim().split("\n");

  if (lines.length <= 1) {
    return [];
  }

  // Check if this is the old 4-column format or new 5-column format
  const header = lines[0];
  const isLegacy = header === "user,title,start,end";

  // Skip header
  return lines.slice(1).map((line) => {
    const fields = parseCSVLine(line);
    if (isLegacy) {
      return {
        user: fields[0] ?? "",
        title: fields[1] ?? "",
        project: "",
        start: fields[2] ?? "",
        end: fields[3] ?? "",
      };
    }
    return {
      user: fields[0] ?? "",
      title: fields[1] ?? "",
      project: fields[2] ?? "",
      start: fields[3] ?? "",
      end: fields[4] ?? "",
    };
  });
}

export async function writeEntries(entries: TimeEntry[]): Promise<void> {
  await writeEntriesAt(process.cwd(), entries);
}

export async function writeEntriesAt(baseDir: string, entries: TimeEntry[]): Promise<void> {
  const csvPath = getCsvPath(baseDir);
  await writeFile(csvPath, formatCSVContent(entries), "utf-8");
}

export function writeEntriesSync(baseDir: string, entries: TimeEntry[]): void {
  const csvPath = getCsvPath(baseDir);
  writeFileSync(csvPath, formatCSVContent(entries), "utf-8");
}

function formatCSVContent(entries: TimeEntry[]): string {
  const lines = [CSV_HEADER];

  for (const entry of entries) {
    lines.push(formatCSVLine(entry));
  }

  return lines.join("\n") + "\n";
}

export async function addEntry(entry: TimeEntry): Promise<void> {
  await addEntryAt(process.cwd(), entry);
}

export async function addEntryAt(baseDir: string, entry: TimeEntry): Promise<number> {
  const entries = await readEntriesAt(baseDir);
  entries.push(entry);
  await writeEntriesAt(baseDir, entries);
  return entries.length - 1;
}

export async function updateEntry(
  index: number,
  updates: Partial<TimeEntry>
): Promise<void> {
  await updateEntryAt(process.cwd(), index, updates);
}

export async function updateEntryAt(
  baseDir: string,
  index: number,
  updates: Partial<TimeEntry>
): Promise<void> {
  const entries = await readEntriesAt(baseDir);
  if (index >= 0 && index < entries.length) {
    entries[index] = { ...entries[index]!, ...updates };
    await writeEntriesAt(baseDir, entries);
  }
}

export function updateEntrySync(
  baseDir: string,
  index: number,
  updates: Partial<TimeEntry>
): boolean {
  const entries = readEntriesSync(baseDir);
  if (index < 0 || index >= entries.length) {
    return false;
  }

  entries[index] = { ...entries[index]!, ...updates };
  writeEntriesSync(baseDir, entries);
  return true;
}

export function finalizeEntrySync(index: number, end: string, baseDir = process.cwd()): boolean {
  const entries = readEntriesSync(baseDir);
  const entry = entries[index];

  if (!entry || entry.end) {
    return false;
  }

  entries[index] = { ...entry, end };
  writeEntriesSync(baseDir, entries);
  return true;
}

export function findActiveEntry(entries: TimeEntry[]): {
  entry: TimeEntry;
  index: number;
} | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (!entries[i]!.end) {
      return { entry: entries[i]!, index: i };
    }
  }
  return null;
}

export function findLastCompletedEntry(entries: TimeEntry[]): {
  entry: TimeEntry;
  index: number;
} | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i]!.end) {
      return { entry: entries[i]!, index: i };
    }
  }
  return null;
}

// CSV parsing helpers
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function formatCSVLine(entry: TimeEntry): string {
  return [
    escapeCSVField(entry.user),
    escapeCSVField(entry.title),
    escapeCSVField(entry.project),
    entry.start,
    entry.end,
  ].join(",");
}

function escapeCSVField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
