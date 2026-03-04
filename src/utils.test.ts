import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import {
  formatElapsedTime,
  getCurrentUser,
  calculateDuration,
  formatDate,
  isToday,
  isThisWeek,
  isThisMonth,
  isThisYear,
} from "./utils";

describe("formatElapsedTime", () => {
  it("should return '0s' when start time is now", () => {
    const start = new Date();
    const result = formatElapsedTime(start.toISOString());
    expect(result).toBe("0s");
  });

  it("should return only seconds when less than a minute", () => {
    const start = new Date(Date.now() - 45 * 1000);
    const result = formatElapsedTime(start.toISOString());
    expect(result).toBe("45s");
  });

  it("should return only minutes when secs is 0", () => {
    const start = new Date(Date.now() - (45 * 60) * 1000);
    const result = formatElapsedTime(start.toISOString());
    expect(result).toBe("45m");
  });

  it("should return minutes and seconds when less than an hour", () => {
    const start = new Date(Date.now() - (5 * 60 + 30) * 1000);
    const result = formatElapsedTime(start.toISOString());
    expect(result).toBe("5m 30s");
  });

  it("should return hours and seconds without minutes when mins is 0", () => {
    const start = new Date(Date.now() - (1 * 3600 + 5) * 1000);
    const result = formatElapsedTime(start.toISOString());
    expect(result).toBe("1h 5s");
  });

  it("should return elapsed time with hours, minutes, and seconds", () => {
    const start = new Date(Date.now() - (1 * 3600 + 30 * 60 + 15) * 1000);
    const result = formatElapsedTime(start.toISOString());
    expect(result).toBe("1h 30m 15s");
  });

  it("should return hours and minutes without seconds when secs is 0", () => {
    const start = new Date(Date.now() - 2 * 3600 * 1000);
    const result = formatElapsedTime(start.toISOString());
    expect(result).toBe("2h");
  });
});

describe("getCurrentUser", () => {
  const originalUser = process.env.USER;
  const originalUsername = process.env.USERNAME;

  afterEach(() => {
    if (originalUser !== undefined) {
      process.env.USER = originalUser;
    } else {
      delete process.env.USER;
    }
    if (originalUsername !== undefined) {
      process.env.USERNAME = originalUsername;
    } else {
      delete process.env.USERNAME;
    }
  });

  it("should return USER env variable when set", () => {
    process.env.USER = "testuser";
    expect(getCurrentUser()).toBe("testuser");
  });

  it("should return USERNAME env variable when USER is not set", () => {
    delete process.env.USER;
    process.env.USERNAME = "winuser";
    expect(getCurrentUser()).toBe("winuser");
  });

  it("should return 'unknown' when neither USER nor USERNAME is set", () => {
    delete process.env.USER;
    delete process.env.USERNAME;
    expect(getCurrentUser()).toBe("unknown");
  });
});

describe("calculateDuration", () => {
  it("should calculate duration between two timestamps", () => {
    const start = "2025-01-01T10:00:00.000Z";
    const end = "2025-01-01T11:30:45.000Z";
    expect(calculateDuration(start, end)).toBe("1h 30m 45s");
  });

  it("should return '0s' when start and end are the same", () => {
    const time = "2025-01-01T10:00:00.000Z";
    expect(calculateDuration(time, time)).toBe("0s");
  });

  it("should handle seconds only", () => {
    const start = "2025-01-01T10:00:00.000Z";
    const end = "2025-01-01T10:00:30.000Z";
    expect(calculateDuration(start, end)).toBe("30s");
  });

  it("should handle minutes and seconds", () => {
    const start = "2025-01-01T10:00:00.000Z";
    const end = "2025-01-01T10:05:15.000Z";
    expect(calculateDuration(start, end)).toBe("5m 15s");
  });

  it("should handle hours without minutes or seconds", () => {
    const start = "2025-01-01T10:00:00.000Z";
    const end = "2025-01-01T13:00:00.000Z";
    expect(calculateDuration(start, end)).toBe("3h");
  });

  it("should handle hours and seconds without minutes", () => {
    const start = "2025-01-01T10:00:00.000Z";
    const end = "2025-01-01T12:00:10.000Z";
    expect(calculateDuration(start, end)).toBe("2h 10s");
  });

  it("should handle multi-day durations", () => {
    const start = "2025-01-01T10:00:00.000Z";
    const end = "2025-01-02T10:00:00.000Z";
    expect(calculateDuration(start, end)).toBe("24h");
  });
});

describe("formatDate", () => {
  it("should format an ISO string to local date/time format", () => {
    const date = new Date(2025, 0, 15, 14, 30, 45); // Jan 15, 2025 14:30:45
    const result = formatDate(date.toISOString());
    expect(result).toBe("2025-01-15 14:30:45");
  });

  it("should pad single digit months, days, hours, minutes, seconds", () => {
    const date = new Date(2025, 2, 5, 8, 3, 7); // Mar 5, 2025 08:03:07
    const result = formatDate(date.toISOString());
    expect(result).toBe("2025-03-05 08:03:07");
  });

  it("should handle midnight", () => {
    const date = new Date(2025, 5, 20, 0, 0, 0); // Jun 20, 2025 00:00:00
    const result = formatDate(date.toISOString());
    expect(result).toBe("2025-06-20 00:00:00");
  });
});

describe("isToday", () => {
  it("should return true for a timestamp from today", () => {
    const now = new Date();
    expect(isToday(now.toISOString())).toBe(true);
  });

  it("should return false for a timestamp from yesterday", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isToday(yesterday.toISOString())).toBe(false);
  });

  it("should return false for a timestamp from tomorrow", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(isToday(tomorrow.toISOString())).toBe(false);
  });

  it("should return true for the start of today", () => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    expect(isToday(startOfDay.toISOString())).toBe(true);
  });

  it("should return true for the end of today", () => {
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    expect(isToday(endOfDay.toISOString())).toBe(true);
  });
});

describe("isThisWeek", () => {
  it("should return true for today", () => {
    const now = new Date();
    expect(isThisWeek(now.toISOString())).toBe(true);
  });

  it("should return false for a date from last month", () => {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    expect(isThisWeek(lastMonth.toISOString())).toBe(false);
  });

  it("should return true for Monday of current week", () => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(12, 0, 0, 0);
    expect(isThisWeek(monday.toISOString())).toBe(true);
  });

  it("should return true for Sunday of current week", () => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? 0 : 7 - day;
    const sunday = new Date(now);
    sunday.setDate(now.getDate() + diff);
    sunday.setHours(12, 0, 0, 0);
    expect(isThisWeek(sunday.toISOString())).toBe(true);
  });

  it("should return false for a date two weeks ago", () => {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    expect(isThisWeek(twoWeeksAgo.toISOString())).toBe(false);
  });
});

describe("isThisMonth", () => {
  it("should return true for today", () => {
    const now = new Date();
    expect(isThisMonth(now.toISOString())).toBe(true);
  });

  it("should return true for the first day of this month", () => {
    const firstDay = new Date();
    firstDay.setDate(1);
    firstDay.setHours(0, 0, 0, 0);
    expect(isThisMonth(firstDay.toISOString())).toBe(true);
  });

  it("should return false for a date from last month", () => {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    expect(isThisMonth(lastMonth.toISOString())).toBe(false);
  });

  it("should return false for a date from next month", () => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    expect(isThisMonth(nextMonth.toISOString())).toBe(false);
  });

  it("should return false for the same month in a different year", () => {
    const lastYear = new Date();
    lastYear.setFullYear(lastYear.getFullYear() - 1);
    expect(isThisMonth(lastYear.toISOString())).toBe(false);
  });
});

describe("isThisYear", () => {
  it("should return true for today", () => {
    const now = new Date();
    expect(isThisYear(now.toISOString())).toBe(true);
  });

  it("should return true for January 1st of this year", () => {
    const jan1 = new Date(new Date().getFullYear(), 0, 1);
    expect(isThisYear(jan1.toISOString())).toBe(true);
  });

  it("should return true for December 31st of this year", () => {
    const dec31 = new Date(new Date().getFullYear(), 11, 31, 23, 59, 59);
    expect(isThisYear(dec31.toISOString())).toBe(true);
  });

  it("should return false for a date from last year", () => {
    const lastYear = new Date();
    lastYear.setFullYear(lastYear.getFullYear() - 1);
    expect(isThisYear(lastYear.toISOString())).toBe(false);
  });

  it("should return false for a date from next year", () => {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    expect(isThisYear(nextYear.toISOString())).toBe(false);
  });
});
