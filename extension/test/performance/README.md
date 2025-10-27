# Performance Tests

These tests verify the extension's performance characteristics under various loads.

## Test Coverage

- **taskProcessing.test.ts**: Tests task processing speed and throughput
- **memoryUsage.test.ts**: Tests memory usage and leak detection

## Running Performance Tests

```bash
npm run test:performance
```

## Notes

Performance tests have longer timeouts and may require specific Node.js flags for accurate memory measurement:

```bash
node --expose-gc node_modules/mocha/bin/mocha out/test/performance/**/*.test.js
```

Performance benchmarks are indicative and may vary based on system resources.
