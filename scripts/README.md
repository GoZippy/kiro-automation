# KiroAutomation helper scripts

This folder contains helper scripts used to configure target projects to work with KiroAutomation.

- `setup-project.js` — Node script to generate a `.kiro/config.json` in a target project, create a `run.cmd` convenience script at the project root, and register the project in `KiroAutomation/.kiro/projects.json`.
- `templates/run.cmd.tpl` — Template for the Windows `run.cmd` script (for reference).

Usage:

```powershell
# from the KiroAutomation repository root
node scripts/setup-project.js ../path/to/target/project
```

The script will:
- Create `.kiro/config.json` (basic defaults)
- Create `run.cmd` at project root which invokes the executor using the configured `executorPath`
- Add or update an entry in `KiroAutomation/.kiro/projects.json`
- Append a short note to the target project's `README.md`
