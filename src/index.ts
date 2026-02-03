#!/usr/bin/env bun

import { startTracking, stopTracking, showStatus, listEntries } from "./commands";

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage: track <start|stop|status|list> [title]");
    process.exit(1);
  }

  const command = args[0];

  try {
    switch (command) {
      case "start": {
        const title = args[1];
        await startTracking(title);
        break;
      }
      case "stop":
        await stopTracking();
        break;
      case "status":
        await showStatus();
        break;
      case "list":
        await listEntries();
        break;
      default:
        console.log(`Unknown command: ${command}`);
        console.log("Usage: track <start|stop|status|list> [title]");
        process.exit(1);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
