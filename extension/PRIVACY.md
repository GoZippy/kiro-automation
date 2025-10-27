# Kiro Automation Extension — Privacy & Telemetry

This document explains what telemetry is collected by the Kiro Automation Extension and how you can control it.

## Summary
- Telemetry is anonymous and opt-in only by default.
- Collected data is limited to high-level usage events (feature usage, task counts, performance metrics) and does not include source code, file contents, paths, or personal identifiers.
- You can opt in or opt out at any time using the extension commands:
  - `Kiro Automation: Enable Telemetry`
  - `Kiro Automation: Disable Telemetry`
  - `Kiro Automation: Show Telemetry Summary`
  - `Kiro Automation: Export Telemetry Data`

## What is collected
- Event type (e.g. `task.started`, `task.completed`)
- Timestamps
- An anonymized identifier (randomly generated per-install)
- Aggregated performance metrics (numeric values)
- Counts and summary statistics

## What is NOT collected
- Source code or file contents
- File paths or filenames
- Email addresses, usernames, tokens, secrets, or other PII
- Any data explicitly marked as private by the user

## Data retention
- Telemetry is stored locally in the extension's storage and can be exported by users.
- The extension keeps a rolling window of recent events (configurable in code).

## How to review and export
Use the commands in the command palette to view a summary or export the telemetry data as JSON.

## Contact
If you have questions about telemetry or privacy, open an issue in the repository or contact the maintainers.
