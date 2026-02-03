# track

A simple CLI tool for time tracking built with TypeScript and Bun.

## Description

`track` is a lightweight command-line time tracker that helps you monitor how much time you spend on tasks. It uses a local CSV file to store tracking data in the current working directory, making it easy to track time across different projects.

Features:

- Start and stop time tracking with optional task titles
- View current tracking status with elapsed time
- Watch mode for live updates of status and elapsed time
- Filter time entries by day, week, month, year, or all time
- Prevents multiple concurrent timers
- Stores data in a simple CSV format for easy access
- Tracks username, task title, start time, and end time

## Installation

### Install from npm (Recommended)

Using npm:

```bash
npm install -g @heyimstas/timetracking
```

Using bun:

```bash
bun add -g @heyimstas/timetracking
```

The `track` command will now be available globally on your system.

### Install from source

For development or if you want to modify the code:

**Prerequisites**: [Bun](https://bun.sh) must be installed on your system

1. Clone this repository:

```bash
git clone https://github.com/HeyImStas/timetracking.git
cd timetracking
```

2. Install dependencies:

```bash
bun install
```

3. Build the project:

```bash
bun run build
```

4. Link the CLI globally:

```bash
bun link
```

The `track` command is now available globally on your system.

## Usage

### Start tracking

Start a timer without a title:
```bash
track start
```

Start a timer with a title:

```bash
track start "my task"
```

Start tracking with live timer display (watch mode):

```bash
track start "my task" --watch
```

You can also specify a custom refresh interval in seconds:

```bash
track start "my task" --watch 2
```

### Stop tracking

Stop the currently running timer:

```bash
track stop
```

### Check status

View the current tracking status:

```bash
track status
```

If a timer is running, it will show the task title (if provided) and elapsed time.
If no timer is running, it will display "Nothing is being tracked".

Watch mode (continuously refresh status):

```bash
track status --watch
```

You can also specify a custom refresh interval in seconds:

```bash
track status --watch 2
```

### List entries

Display a formatted table of time tracking entries. By default, shows entries for today:

```bash
track list
```

Filter entries by different time periods:

```bash
track list --day     # Today's entries (default)
track list --week    # This week's entries
track list --month   # This month's entries
track list --year    # This year's entries
track list --all     # All entries
```

This command shows entries in a nicely formatted table with:

- User who created the entry
- Task title
- Start time
- End time (or "In progress" for active timers)
- Duration
- Summary with total entries, completed entries, and total time tracked

## Examples

```bash
# Start tracking a task
$ track start "Writing documentation"
Started tracking for "Writing documentation"

# Check the status
$ track status
Tracking: "Writing documentation" - 1m 23s

# Try to start another task (will fail)
$ track start "Another task"
A timer is already running (Writing documentation)

# Stop the current timer
$ track stop
Stopped tracking "Writing documentation" (5m 47s)

# Start tracking without a title
$ track start
Started tracking

# Check status
$ track status
Tracking: 15s

# Stop tracking
$ track stop
Stopped tracking (30s)

# List all entries for today (default)
$ track list
User | Title                 | Start               | End                 | Duration
---------------------------------------------------------------------------------
stas | Writing documentation | 2026-02-03 14:00:00 | 2026-02-03 14:05:47 | 5m 47s  
stas |                       | 2026-02-03 14:10:00 | 2026-02-03 14:10:30 | 30s     
stas | Another task          | 2026-02-03 14:15:00 | In progress         | 2m 15s  
---------------------------------------------------------------------------------
Total: 3 entries, 2 completed, 6m 17s tracked

# List all entries for this week
$ track list --week

# Use watch mode for live timer updates
$ track start "Writing code" --watch
⏱  Tracking: "Writing code" - 1m 23s

Press Ctrl+C to exit
```

## Data Storage

Tracking data is stored in a `timetrack.csv` file in the **current working directory** where you run the commands. The CSV format is:

```csv
user,title,start,end
stas,"Writing documentation",2026-02-03T14:00:00.000Z,2026-02-03T14:05:47.000Z
stas,,2026-02-03T14:10:00.000Z,2026-02-03T14:10:30.000Z
```

This makes it easy to import the data into spreadsheets or other tools for analysis. Also allows time-tracking specific projects much easier.
