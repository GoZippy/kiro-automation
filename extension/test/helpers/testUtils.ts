import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Creates a temporary test workspace with .kiro directory structure
 */
export function createTestWorkspace(name: string = 'test-workspace'): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `kiro-${name}-`));
  const kiroDir = path.join(tempDir, '.kiro');
  const specsDir = path.join(kiroDir, 'specs');
  
  fs.mkdirSync(specsDir, { recursive: true });
  
  return tempDir;
}

/**
 * Cleans up a test workspace directory
 */
export function cleanupTestWorkspace(workspaceDir: string): void {
  if (fs.existsSync(workspaceDir)) {
    fs.rmSync(workspaceDir, { recursive: true, force: true });
  }
}

/**
 * Creates a test spec directory with tasks.md file
 */
export function createTestSpec(
  workspaceDir: string,
  specName: string,
  tasksContent: string,
  options?: {
    requirements?: string;
    design?: string;
  }
): string {
  const specDir = path.join(workspaceDir, '.kiro', 'specs', specName);
  fs.mkdirSync(specDir, { recursive: true });
  
  fs.writeFileSync(path.join(specDir, 'tasks.md'), tasksContent);
  
  if (options?.requirements) {
    fs.writeFileSync(path.join(specDir, 'requirements.md'), options.requirements);
  }
  
  if (options?.design) {
    fs.writeFileSync(path.join(specDir, 'design.md'), options.design);
  }
  
  return specDir;
}

/**
 * Reads the content of a file
 */
export function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Waits for a specified duration
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Waits for a condition to be true with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options?: {
    timeout?: number;
    interval?: number;
    timeoutMessage?: string;
  }
): Promise<void> {
  const timeout = options?.timeout ?? 5000;
  const interval = options?.interval ?? 100;
  const timeoutMessage = options?.timeoutMessage ?? 'Condition not met within timeout';
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const result = await Promise.resolve(condition());
    if (result) {
      return;
    }
    await delay(interval);
  }
  
  throw new Error(timeoutMessage);
}

/**
 * Copies fixture files to a test workspace
 */
export function copyFixture(fixtureName: string, targetDir: string): void {
  const fixturesDir = path.join(__dirname, '..', 'fixtures');
  const sourcePath = path.join(fixturesDir, fixtureName);
  
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Fixture not found: ${fixtureName}`);
  }
  
  copyRecursive(sourcePath, targetDir);
}

/**
 * Recursively copies a directory
 */
function copyRecursive(source: string, target: string): void {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
  
  const items = fs.readdirSync(source);
  
  for (const item of items) {
    const sourcePath = path.join(source, item);
    const targetPath = path.join(target, item);
    
    if (fs.statSync(sourcePath).isDirectory()) {
      copyRecursive(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

/**
 * Creates a mock file watcher that can be controlled in tests
 */
export class MockFileWatcher {
  private listeners: Map<string, Function[]> = new Map();
  
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }
  
  emit(event: string, ...args: any[]): void {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach((callback) => callback(...args));
  }
  
  dispose(): void {
    this.listeners.clear();
  }
}

/**
 * Asserts that an error is thrown with a specific message
 */
export async function assertThrows(
  fn: () => Promise<any> | any,
  expectedMessage?: string | RegExp
): Promise<Error> {
  try {
    await Promise.resolve(fn());
    throw new Error('Expected function to throw an error');
  } catch (error) {
    if (error instanceof Error) {
      if (expectedMessage) {
        if (typeof expectedMessage === 'string') {
          if (!error.message.includes(expectedMessage)) {
            throw new Error(
              `Expected error message to include "${expectedMessage}", but got "${error.message}"`
            );
          }
        } else {
          if (!expectedMessage.test(error.message)) {
            throw new Error(
              `Expected error message to match ${expectedMessage}, but got "${error.message}"`
            );
          }
        }
      }
      return error;
    }
    throw new Error('Expected error to be an instance of Error');
  }
}

/**
 * Creates a spy function that tracks calls
 */
export function createSpy<T extends (...args: any[]) => any>(
  implementation?: T
): T & { calls: any[][]; callCount: number; reset: () => void } {
  const calls: any[][] = [];
  
  const spy = ((...args: any[]) => {
    calls.push(args);
    if (implementation) {
      return implementation(...args);
    }
  }) as any;
  
  Object.defineProperty(spy, 'calls', {
    get: () => calls,
  });
  
  Object.defineProperty(spy, 'callCount', {
    get: () => calls.length,
  });
  
  spy.reset = () => {
    calls.length = 0;
  };
  
  return spy;
}
