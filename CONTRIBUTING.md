# Contributing to Kiro Automation

Thank you for your interest in contributing to Kiro Automation! This document provides guidelines and instructions for contributing.

## Getting Started

### Prerequisites

- Node.js 14.0.0 or higher
- VS Code 1.60.0 or higher (for extension development)
- Git
- Kiro IDE installed

### Setup Development Environment

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd kiro-automation
   ```

2. **Install dependencies**
   ```bash
   npm run install:all
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

## Project Structure

```
kiro-automation/
├── executor/              # Autonomous task execution service
│   ├── autonomous-executor.js
│   ├── task-executor.js
│   └── simple-executor.js
├── extension/             # VS Code extension
│   ├── src/
│   ├── test/
│   └── package.json
├── docs/                  # Documentation
└── scripts/               # Utility scripts
```

## Development Workflow

### Working on the Executor

1. Navigate to the executor directory
   ```bash
   cd executor
   ```

2. Make your changes

3. Test locally
   ```bash
   node autonomous-executor.js --spec test-spec
   ```

4. Run tests (when available)
   ```bash
   npm test
   ```

### Working on the Extension

1. Navigate to the extension directory
   ```bash
   cd extension
   ```

2. Make your changes

3. Compile TypeScript
   ```bash
   npm run compile
   ```

4. Test in VS Code
   - Press F5 to launch Extension Development Host
   - Test your changes

5. Run tests
   ```bash
   npm test
   ```

## Coding Standards

### JavaScript/TypeScript

- Use ES6+ features
- Follow ESLint configuration
- Use Prettier for formatting
- Write meaningful variable and function names
- Add JSDoc comments for public APIs

### Code Style

```typescript
// Good
async function executeTask(task: Task): Promise<ExecutionResult> {
  try {
    const result = await this.processTask(task);
    return { success: true, data: result };
  } catch (error) {
    this.logger.error('Task execution failed', { task, error });
    throw new TaskExecutionError('Failed to execute task', { cause: error });
  }
}

// Bad
async function exec(t) {
  return await proc(t);
}
```

### Testing

- Write unit tests for new features
- Maintain test coverage above 80%
- Use descriptive test names
- Test edge cases and error conditions

```typescript
describe('TaskManager', () => {
  it('should parse tasks from markdown correctly', async () => {
    const tasks = await taskManager.parseTasks('tasks.md');
    expect(tasks).toHaveLength(5);
    expect(tasks[0].id).toBe('1');
  });

  it('should handle malformed task files gracefully', async () => {
    await expect(taskManager.parseTasks('invalid.md'))
      .rejects.toThrow(ParseError);
  });
});
```

## Commit Guidelines

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring
- **test**: Adding or updating tests
- **chore**: Maintenance tasks

### Examples

```
feat(executor): add retry logic for failed tasks

Implement exponential backoff retry mechanism for tasks that fail
due to transient errors. Configurable via maxRetries setting.

Closes #123
```

```
fix(extension): resolve task status update race condition

Fixed race condition where multiple task status updates could
occur simultaneously, causing inconsistent state.

Fixes #456
```

## Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow coding standards
   - Add tests
   - Update documentation

3. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: your feature description"
   ```

4. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Create Pull Request**
   - Provide clear description
   - Reference related issues
   - Include screenshots if UI changes
   - Ensure CI passes

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] Tests added/updated and passing
- [ ] Documentation updated
- [ ] Commit messages follow guidelines
- [ ] No merge conflicts
- [ ] CI/CD pipeline passes

## Testing

### Running Tests

```bash
# All tests
npm test

# Executor tests
npm run test:executor

# Extension tests
npm run test:extension

# With coverage
npm run test:coverage
```

### Writing Tests

- Place tests in `test/` directory
- Use descriptive test names
- Test both success and failure cases
- Mock external dependencies

## Documentation

### Code Documentation

- Add JSDoc comments for public APIs
- Include parameter descriptions
- Document return types
- Add usage examples

```typescript
/**
 * Executes a task autonomously with retry logic
 * 
 * @param task - The task to execute
 * @param context - Execution context including requirements and design
 * @returns Promise resolving to execution result
 * @throws {TaskExecutionError} If task fails after all retries
 * 
 * @example
 * ```typescript
 * const result = await executor.executeTask(task, context);
 * if (result.success) {
 *   console.log('Task completed');
 * }
 * ```
 */
async executeTask(task: Task, context: ExecutionContext): Promise<ExecutionResult>
```

### README Updates

- Update README.md when adding features
- Include usage examples
- Update configuration options
- Add troubleshooting tips

## Release Process

1. Update version in package.json
2. Update CHANGELOG.md
3. Create release tag
4. Build and test
5. Publish to npm/marketplace
6. Create GitHub release

## Getting Help

- Check existing issues
- Read documentation
- Ask in discussions
- Contact maintainers

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn and grow
- Follow project guidelines

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Questions?

Feel free to open an issue or reach out to the maintainers.

Thank you for contributing to Kiro Automation! 🚀
