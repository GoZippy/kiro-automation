# Kiro Automation Extension Test Suite

Comprehensive test suite for the Kiro Automation Extension covering unit, integration, end-to-end, and performance testing.

## Test Structure

```
test/
├── suite/              # Unit tests for individual components
├── integration/        # Integration tests for component interactions
├── e2e/               # End-to-end workflow tests
├── performance/       # Performance and load tests
├── fixtures/          # Test fixtures and mock data
│   ├── mocks/        # Mock implementations
│   ├── specs/        # Sample spec files
│   └── data/         # Test data files
└── helpers/          # Test utilities and helpers
```

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests
```bash
npm run test:integration
```

### End-to-End Tests
```bash
npm run test:e2e
```

### Performance Tests
```bash
npm run test:performance
```

### With Coverage
```bash
npm run test:coverage        # Unit tests with coverage
npm run test:coverage:all    # All tests with coverage
```

### Watch Mode
```bash
npm run test:watch
```

## Test Coverage Goals

- **Branches**: 80%
- **Lines**: 80%
- **Functions**: 80%
- **Statements**: 80%

Coverage reports are generated in the `coverage/` directory.

## Writing Tests

### Unit Tests

Unit tests should:
- Test individual functions and classes in isolation
- Use mocks for external dependencies
- Be fast (< 100ms per test)
- Follow the AAA pattern (Arrange, Act, Assert)

Example:
```typescript
test('should parse task status correctly', () => {
  const taskManager = new TaskManager(workspaceDir);
  const task = taskManager.parseTask('- [x] 1. Completed task');
  assert.strictEqual(task.status, TaskStatus.COMPLETED);
});
```

### Integration Tests

Integration tests should:
- Test interactions between components
- Use real implementations where possible
- Mock only external systems (Kiro API, file system)
- Verify data flow between components

Example:
```typescript
test('should persist task status to file', async () => {
  const taskManager = new TaskManager(workspaceDir);
  await taskManager.discoverTasks();
  taskManager.updateTaskStatus('1', TaskStatus.COMPLETED);
  
  // Verify file was updated
  const content = fs.readFileSync(tasksFile, 'utf-8');
  assert.ok(content.includes('[x]'));
});
```

### End-to-End Tests

E2E tests should:
- Test complete user workflows
- Verify system behavior from start to finish
- Use realistic test data
- Have longer timeouts for complex operations

Example:
```typescript
test('should complete full automation cycle', async function() {
  this.timeout(10000);
  
  // Setup test workspace with specs
  createTestSpec(workspaceDir, 'test-spec', tasksContent);
  
  // Run automation
  await automationEngine.start();
  
  // Verify all tasks completed
  const tasks = await taskManager.discoverTasks();
  assert.ok(tasks.every(t => t.status === TaskStatus.COMPLETED));
});
```

### Performance Tests

Performance tests should:
- Measure execution time and resource usage
- Test with realistic data volumes
- Use longer timeouts
- Log performance metrics

Example:
```typescript
test('should process 100 tasks efficiently', async function() {
  this.timeout(30000);
  
  const startTime = Date.now();
  await automationEngine.processAllTasks();
  const duration = Date.now() - startTime;
  
  assert.ok(duration < 20000, `Took ${duration}ms`);
  console.log(`Processed 100 tasks in ${duration}ms`);
});
```

## Test Utilities

### Test Helpers (`helpers/testUtils.ts`)

- `createTestWorkspace()`: Creates temporary test workspace
- `cleanupTestWorkspace()`: Cleans up test workspace
- `createTestSpec()`: Creates test spec with tasks
- `waitFor()`: Waits for condition with timeout
- `delay()`: Promise-based delay
- `assertThrows()`: Asserts function throws error
- `createSpy()`: Creates spy function for tracking calls

### Mock Implementations (`fixtures/mocks/`)

- `MockKiroInterface`: Mock Kiro API for testing
- `MockFileWatcher`: Mock file system watcher
- Additional mocks as needed

### Test Fixtures (`fixtures/`)

- Sample spec directories with tasks.md files
- Mock data for various test scenarios
- Reusable test configurations

## Continuous Integration

Tests are automatically run on:
- Every commit (unit tests)
- Pull requests (all tests)
- Pre-publish (all tests + coverage)

## Debugging Tests

### VS Code Launch Configuration

Use the provided launch configuration in `.vscode/launch.json`:
- "Extension Tests" - Run all tests with debugger
- "Current Test File" - Debug currently open test file

### Mocha Options

Add `.only` to run specific tests:
```typescript
test.only('should test specific behavior', () => {
  // This test will run exclusively
});
```

Add `.skip` to skip tests:
```typescript
test.skip('should test future feature', () => {
  // This test will be skipped
});
```

## Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up resources in teardown
3. **Descriptive Names**: Test names should describe what they test
4. **Fast Tests**: Keep unit tests fast (< 100ms)
5. **Realistic Data**: Use realistic test data
6. **Error Cases**: Test both success and failure paths
7. **Edge Cases**: Test boundary conditions
8. **Documentation**: Document complex test setups

## Troubleshooting

### Tests Timing Out

- Increase timeout: `this.timeout(10000)`
- Check for unresolved promises
- Verify cleanup in teardown

### Flaky Tests

- Check for race conditions
- Add proper waits for async operations
- Ensure test isolation

### Memory Leaks

- Verify all resources are disposed
- Check for event listener cleanup
- Use `forceGC()` in performance tests

## Contributing

When adding new features:
1. Write tests first (TDD)
2. Ensure all tests pass
3. Maintain coverage above 80%
4. Update test documentation
5. Add integration tests for new components
6. Add E2E tests for new workflows

## Resources

- [Mocha Documentation](https://mochajs.org/)
- [VS Code Extension Testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [Istanbul Coverage](https://istanbul.js.org/)
