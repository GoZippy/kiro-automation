# Integration Tests

These tests verify interactions between different components of the extension.

## Test Coverage

- **kiroApiIntegration.test.ts**: Tests Kiro API communication with mocks
- **fileSystemOperations.test.ts**: Tests file system operations and task persistence
- **configurationManagement.test.ts**: Tests configuration loading and updates

## Running Integration Tests

```bash
npm run test:integration
```

## Notes

Integration tests use a combination of real and mocked components to test component interactions while maintaining test isolation and speed.
