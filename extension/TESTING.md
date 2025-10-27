# Testing Guide

## Overview

The Kiro Automation Extension includes a comprehensive test suite covering unit, integration, end-to-end, and performance testing.

## Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:performance
```

## Test Infrastructure

### Test Runner
- **Mocha**: Test framework with TDD interface
- **NYC/Istanbul**: Code coverage reporting
- **@vscode/test-electron**: VS Code extension testing

### Coverage Configuration
- Minimum coverage: 80% (branches, lines, functions, statements)
- Reports: Text, HTML, LCOV
- Configuration: `.nycrc.json`

### Test Scripts
```json
{
  "test": "Run all tests",
  "test:unit": "Run unit tests only",
  "test:integration": "Run integration tests",
  "test:e2e": "Run end-to-end tests",
  "test:performance": "Run performance tests",
  "test:coverage": "Run with coverage report",
  "test:watch": "Run in watch mode"
}
```

## Test Structure

### Unit Tests (`test/suite/`)
- **taskManager.test.ts**: Task discovery, parsing, status management
- **automationEngine.test.ts**: Engine state, error handling, retry logic
- **kiroInterface.test.ts**: Kiro API communication
- **extension.test.ts**: Extension activation and commands

### Integration Tests (`test/integration/`)
- **kiroApiIntegration.test.ts**: Kiro API with mocks
- **fileSystemOperations.test.ts**: File operations and persistence
- **configurationManagement.test.ts**: Configuration loading and updates

### End-to-End Tests (`test/e2e/`)
- **completeWorkflow.test.ts**: Full automation workflows
- **pauseResume.test.ts**: Pause/resume functionality

### Performance Tests (`test/performance/`)
- **taskProcessing.test.ts**: Processing speed and throughput
- **memoryUsage.test.ts**: Memory usage and leak detection

## Test Fixtures

### Mock Implementations (`test/fixtures/mocks/`)
- **MockKiroInterface**: Simulates Kiro API responses
  - Configurable response delays
  - Failure rate simulation
  - Message history tracking
  - Connection state management

### Sample Data (`test/fixtures/specs/`)
- Sample spec directories with tasks.md files
- Requirements and design documents
- Various task states and hierarchies

### Test Utilities (`test/helpers/`)
- **testUtils.ts**: Helper functions for test setup
  - Workspace creation/cleanup
  - Spec file generation
  - Async utilities (waitFor, delay)
  - Assertion helpers
  - Spy functions

## Writing Tests

### Test Template

```typescript
import * as assert from 'assert';
import { ComponentUnderTest } from '../../src/ComponentUnderTest';
import { createTestWorkspace, cleanupTestWorkspace } from '../helpers/testUtils';

suite('Component Test Suite', () => {
  let workspaceDir: string;
  let component: ComponentUnderTest;

  setup(() => {
    workspaceDir = createTestWorkspace('test-name');
    component = new ComponentUnderTest(workspaceDir);
  });

  teardown(() => {
    component.dispose();
    cleanupTestWorkspace(workspaceDir);
  });

  test('should do something', () => {
    // Arrange
    const input = 'test input';
    
    // Act
    const result = component.doSomething(input);
    
    // Assert
    assert.strictEqual(result, 'expected output');
  });
});
```

### Best Practices

1. **Test Isolation**: Each test should be independent
2. **Descriptive Names**: Use clear, descriptive test names
3. **AAA Pattern**: Arrange, Act, Assert
4. **Cleanup**: Always dispose resources in teardown
5. **Async Handling**: Properly handle promises and async operations
6. **Timeouts**: Set appropriate timeouts for long-running tests
7. **Error Testing**: Test both success and failure paths

## Coverage Reports

### Generating Reports

```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open coverage/index.html
```

### Coverage Thresholds

The project enforces minimum coverage thresholds:
- Branches: 80%
- Lines: 80%
- Functions: 80%
- Statements: 80%

Builds will fail if coverage falls below these thresholds.

## Continuous Integration

### Pre-commit
- Linting
- Unit tests
- Type checking

### Pull Requests
- All test suites
- Coverage reporting
- Performance benchmarks

### Pre-publish
- Full test suite
- Coverage validation
- Integration tests

## Debugging Tests

### VS Code Debugging

1. Set breakpoints in test files
2. Use "Extension Tests" launch configuration
3. Run debugger (F5)

### Mocha Debugging

```bash
# Run specific test file with debugging
node --inspect-brk node_modules/mocha/bin/mocha out/test/suite/taskManager.test.js
```

### Selective Test Execution

```typescript
// Run only this test
test.only('should test specific behavior', () => {
  // Test code
});

// Skip this test
test.skip('should test future feature', () => {
  // Test code
});
```

## Performance Testing

### Memory Testing

Performance tests can use Node.js garbage collection:

```bash
# Run with GC exposed
node --expose-gc node_modules/mocha/bin/mocha out/test/performance/**/*.test.js
```

### Benchmarking

Performance tests log execution times:

```typescript
test('should process tasks efficiently', async function() {
  this.timeout(30000);
  
  const startTime = Date.now();
  await processLargeBatch();
  const duration = Date.now() - startTime;
  
  console.log(`Processed in ${duration}ms`);
  assert.ok(duration < 20000);
});
```

## Troubleshooting

### Common Issues

**Tests timing out**
- Increase timeout: `this.timeout(10000)`
- Check for unresolved promises
- Verify async/await usage

**Flaky tests**
- Add proper waits for async operations
- Ensure test isolation
- Check for race conditions

**Memory leaks**
- Verify resource disposal in teardown
- Check event listener cleanup
- Use memory profiling tools

**Coverage gaps**
- Identify untested code paths
- Add tests for edge cases
- Test error handling

## Resources

- [Mocha Documentation](https://mochajs.org/)
- [VS Code Extension Testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [Istanbul/NYC Coverage](https://istanbul.js.org/)
- [Test README](./test/README.md)

## Contributing

When adding new features:
1. Write tests first (TDD approach)
2. Ensure all tests pass
3. Maintain coverage above 80%
4. Update test documentation
5. Add integration tests for component interactions
6. Add E2E tests for new workflows
7. Consider performance implications

## Support

For testing questions or issues:
1. Check this documentation
2. Review existing tests for examples
3. Consult test README files in subdirectories
4. Open an issue on GitHub
