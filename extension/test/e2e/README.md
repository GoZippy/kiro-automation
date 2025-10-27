# End-to-End Tests

These tests verify complete automation workflows from start to finish.

## Test Coverage

- **completeWorkflow.test.ts**: Tests full automation cycles with multiple tasks and specs
- **pauseResume.test.ts**: Tests pause/resume functionality during execution

## Running E2E Tests

```bash
npm run test:e2e
```

## Notes

E2E tests use mock implementations of Kiro interfaces to avoid dependencies on the actual Kiro IDE. They focus on testing the automation engine's orchestration logic and state management.

Tests may require longer timeouts due to simulated task execution delays.
