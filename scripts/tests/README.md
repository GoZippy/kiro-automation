Test isolation and debugging
===========================

These test scripts intentionally run against temporary copies of workspaces where appropriate to avoid mutating real project files in the repository.

What the integration test does
- `integration-dryrun.js` copies the `ZippyGameAdmin` workspace into a temporary directory, runs the executor with `--workspace` pointed at that temp copy, verifies the expected automation artifacts (state/log) were created, and then deletes the temp copy on success.
- If the test fails, the temp workspace is preserved for debugging and its path is printed to stdout/stderr.

Preserving artifacts for debugging
- To keep the temp workspace even when the test succeeds (for debugging), set an environment variable in your shell before running the tests. Example (PowerShell):

  $env:KEEP_TEST_ARTIFACTS = '1'
  node scripts/tests/integration-dryrun.js

- On Linux/macOS (bash):

  export KEEP_TEST_ARTIFACTS=1
  node scripts/tests/integration-dryrun.js

Note: The current integration test preserves the temp workspace automatically on failure and prints its path. The environment variable above is honored by CI/dev runs if you need to inspect successful runs.

Other test guidance
- Unit/concurrency tests use temporary directories where applicable; if you add new tests that touch workspaces, prefer `fs.mkdtempSync()` + `fs.cpSync()` (Node 16+) to safely operate on copies.
