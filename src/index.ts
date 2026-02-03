#!/usr/bin/env bun

import { Command } from "commander";
import { startTracking, stopTracking, showStatus, listEntries, type DateFilter } from "./commands";

const program = new Command();

program
  .name("track")
  .description("Simple time tracking CLI")
  .version("1.0.0");

program
  .command("start")
  .description("Start tracking time")
  .argument("[title]", "optional title for the task")
  .option("--watch [interval]", "continuously display current time (default: 1 second)")
  .action(async (title?: string, options?: { watch?: string }) => {
    try {
      const watchInterval = options?.watch !== undefined 
        ? (typeof options.watch === 'string' ? parseFloat(options.watch) : 1)
        : undefined;
      await startTracking(title, watchInterval);
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command("stop")
  .description("Stop tracking time")
  .action(async () => {
    try {
      await stopTracking();
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command("status")
  .description("Show current tracking status")
  .option("--watch [interval]", "continuously refresh status (default: 1 second)")
  .action(async (options?: { watch?: string }) => {
    try {
      const watchInterval = options?.watch !== undefined 
        ? (typeof options.watch === 'string' ? parseFloat(options.watch) : 1)
        : undefined;
      await showStatus(watchInterval);
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command("list")
  .description("List time entries (defaults to today)")
  .option("-d, --day", "show entries for today")
  .option("-w, --week", "show entries for this week")
  .option("-m, --month", "show entries for this month")
  .option("-y, --year", "show entries for this year")
  .option("-a, --all", "show all entries")
  .action(async (options) => {
    try {
      let filter: DateFilter = "day"; // default to today
      
      if (options.all) {
        filter = "all";
      } else if (options.year) {
        filter = "year";
      } else if (options.month) {
        filter = "month";
      } else if (options.week) {
        filter = "week";
      } else if (options.day) {
        filter = "day";
      }
      
      await listEntries(filter);
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
