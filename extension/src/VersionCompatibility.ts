import * as vscode from 'vscode';
import { Logger } from './Logger';

/**
 * Simple semver comparison utilities
 */
class SemverUtils {
  static parse(version: string): { major: number; minor: number; patch: number; prerelease?: string } | null {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
    if (!match) {
      return null;
    }
    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10),
      prerelease: match[4],
    };
  }

  static compare(v1: string, v2: string): number {
    const p1 = this.parse(v1);
    const p2 = this.parse(v2);
    if (!p1 || !p2) {
      return 0;
    }

    if (p1.major !== p2.major) {
      return p1.major - p2.major;
    }
    if (p1.minor !== p2.minor) {
      return p1.minor - p2.minor;
    }
    return p1.patch - p2.patch;
  }

  static gte(v1: string, v2: string): boolean {
    return this.compare(v1, v2) >= 0;
  }

  static lt(v1: string, v2: string): boolean {
    return this.compare(v1, v2) < 0;
  }

  static satisfies(version: string, range: string): boolean {
    // Simple range matching for >=x.x.x <y.y.y format
    const rangeMatch = range.match(/>=(\S+)\s+<(\S+)/);
    if (rangeMatch) {
      const min = rangeMatch[1];
      const max = rangeMatch[2];
      return this.gte(version, min) && this.lt(version, max);
    }
    return false;
  }
}

/**
 * Version information
 */
export interface VersionInfo {
  /** Version string */
  version: string;

  /** Major version */
  major: number;

  /** Minor version */
  minor: number;

  /** Patch version */
  patch: number;

  /** Pre-release tag */
  prerelease?: string;
}

/**
 * Compatibility check result
 */
export interface CompatibilityResult {
  /** Whether versions are compatible */
  compatible: boolean;

  /** Kiro version */
  kiroVersion?: VersionInfo;

  /** Extension version */
  extensionVersion: VersionInfo;

  /** Compatibility issues */
  issues: string[];

  /** Warnings */
  warnings: string[];

  /** Recommended actions */
  recommendations: string[];
}

/**
 * API adapter interface
 */
export interface APIAdapter {
  /** Adapter name */
  name: string;

  /** Supported version range */
  versionRange: string;

  /** Adapter methods */
  methods: Record<string, Function>;
}

/**
 * Migration path
 */
export interface MigrationPath {
  /** From version */
  fromVersion: string;

  /** To version */
  toVersion: string;

  /** Migration steps */
  steps: MigrationStep[];

  /** Whether migration is automatic */
  automatic: boolean;
}

/**
 * Migration step
 */
export interface MigrationStep {
  /** Step description */
  description: string;

  /** Step function */
  execute: () => Promise<void>;

  /** Whether step is required */
  required: boolean;
}

/**
 * Version Compatibility Manager
 * Handles version detection, compatibility checking, and API adaptation
 */
export class VersionCompatibility {
  private logger: Logger;
  private kiroVersion?: VersionInfo;
  private extensionVersion: VersionInfo;
  private adapters: Map<string, APIAdapter> = new Map();
  private currentAdapter?: APIAdapter;
  private migrationPaths: MigrationPath[] = [];

  constructor(logger: Logger) {
    this.logger = logger;
    this.extensionVersion = this.detectExtensionVersion();
  }

  /**
   * Initializes version compatibility checking
   * @returns Compatibility result
   */
  async initialize(): Promise<CompatibilityResult> {
    try {
      this.logger.info('Initializing version compatibility', {
        component: 'VersionCompatibility',
        extensionVersion: this.extensionVersion.version,
      });

      // Detect Kiro version
      this.kiroVersion = await this.detectKiroVersion();

      // Check compatibility
      const result = this.checkCompatibility();

      if (!result.compatible) {
        this.logger.warning('Version compatibility issues detected', {
          component: 'VersionCompatibility',
          issues: result.issues,
        });
      }

      // Select appropriate API adapter
      if (this.kiroVersion) {
        this.selectAPIAdapter(this.kiroVersion);
      }

      // Register default adapters
      this.registerDefaultAdapters();

      return result;
    } catch (error) {
      this.logger.error('Failed to initialize version compatibility', {
        component: 'VersionCompatibility',
        error: (error as Error).message,
      });

      return {
        compatible: false,
        extensionVersion: this.extensionVersion,
        issues: ['Failed to detect Kiro version'],
        warnings: [],
        recommendations: ['Ensure Kiro IDE is installed and active'],
      };
    }
  }

  /**
   * Detects Kiro version
   * @returns Version information
   */
  private async detectKiroVersion(): Promise<VersionInfo | undefined> {
    try {
      // Try to get Kiro extension
      const kiroExtension = vscode.extensions.getExtension('kiro.kiro');

      if (!kiroExtension) {
        this.logger.warning('Kiro extension not found', {
          component: 'VersionCompatibility',
        });
        return undefined;
      }

      // Get version from package.json
      const version = kiroExtension.packageJSON.version;

      if (!version) {
        this.logger.warning('Kiro version not found in package.json', {
          component: 'VersionCompatibility',
        });
        return undefined;
      }

      const parsed = SemverUtils.parse(version);

      if (!parsed) {
        this.logger.warning('Failed to parse Kiro version', {
          component: 'VersionCompatibility',
          version,
        });
        return undefined;
      }

      const versionInfo: VersionInfo = {
        version,
        major: parsed.major,
        minor: parsed.minor,
        patch: parsed.patch,
        prerelease: parsed.prerelease,
      };

      this.logger.info('Detected Kiro version', {
        component: 'VersionCompatibility',
        version: versionInfo.version,
      });

      return versionInfo;
    } catch (error) {
      this.logger.error('Error detecting Kiro version', {
        component: 'VersionCompatibility',
        error: (error as Error).message,
      });
      return undefined;
    }
  }

  /**
   * Detects/gets extension version
   * @returns Version information
   */
  private detectExtensionVersion(): VersionInfo {
    const extension = vscode.extensions.getExtension('kiro.kiro-automation-extension');
    const version = extension?.packageJSON.version || '0.1.0';

    const parsed = SemverUtils.parse(version) || SemverUtils.parse('0.1.0')!;

    return {
      version,
      major: parsed.major,
      minor: parsed.minor,
      patch: parsed.patch,
      prerelease: parsed.prerelease,
    };
  }

  /**
   * Checks version compatibility
   * @returns Compatibility result
   */
  private checkCompatibility(): CompatibilityResult {
    const issues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    if (!this.kiroVersion) {
      issues.push('Kiro version could not be detected');
      recommendations.push('Install or activate Kiro IDE extension');

      return {
        compatible: false,
        extensionVersion: this.extensionVersion,
        issues,
        warnings,
        recommendations,
      };
    }

    // Check minimum version requirement (example: 1.0.0)
    const minVersion = '1.0.0';
    if (SemverUtils.lt(this.kiroVersion.version, minVersion)) {
      issues.push(`Kiro version ${this.kiroVersion.version} is below minimum required version ${minVersion}`);
      recommendations.push(`Update Kiro IDE to version ${minVersion} or higher`);
    }

    // Check for breaking changes
    if (this.kiroVersion.major < this.extensionVersion.major) {
      warnings.push('Kiro major version is older than extension expects');
      recommendations.push('Consider updating Kiro IDE to the latest version');
    }

    // Check for pre-release versions
    if (this.kiroVersion.prerelease) {
      warnings.push('Using pre-release version of Kiro IDE');
      recommendations.push('Pre-release versions may have unstable APIs');
    }

    const compatible = issues.length === 0;

    return {
      compatible,
      kiroVersion: this.kiroVersion,
      extensionVersion: this.extensionVersion,
      issues,
      warnings,
      recommendations,
    };
  }

  /**
   * Registers an API adapter
   * @param adapter API adapter
   */
  registerAdapter(adapter: APIAdapter): void {
    this.adapters.set(adapter.name, adapter);
    this.logger.debug('Registered API adapter', {
      component: 'VersionCompatibility',
      name: adapter.name,
      versionRange: adapter.versionRange,
    });
  }

  /**
   * Selects appropriate API adapter based on version
   * @param version Kiro version
   */
  private selectAPIAdapter(version: VersionInfo): void {
    for (const adapter of this.adapters.values()) {
      if (SemverUtils.satisfies(version.version, adapter.versionRange)) {
        this.currentAdapter = adapter;
        this.logger.info('Selected API adapter', {
          component: 'VersionCompatibility',
          adapter: adapter.name,
          version: version.version,
        });
        return;
      }
    }

    this.logger.warning('No suitable API adapter found', {
      component: 'VersionCompatibility',
      version: version.version,
    });
  }

  /**
   * Gets current API adapter
   * @returns Current adapter or undefined
   */
  getCurrentAdapter(): APIAdapter | undefined {
    return this.currentAdapter;
  }

  /**
   * Registers default API adapters
   */
  private registerDefaultAdapters(): void {
    // Adapter for Kiro 1.x
    this.registerAdapter({
      name: 'kiro-1.x',
      versionRange: '>=1.0.0 <2.0.0',
      methods: {
        sendMessage: async (message: string) => {
          // Implementation for Kiro 1.x
          return await vscode.commands.executeCommand('kiro.sendMessage', message);
        },
        getTaskStatus: async (taskId: string) => {
          // Implementation for Kiro 1.x
          return await vscode.commands.executeCommand('kiro.getTaskStatus', taskId);
        },
      },
    });

    // Adapter for Kiro 2.x (future)
    this.registerAdapter({
      name: 'kiro-2.x',
      versionRange: '>=2.0.0 <3.0.0',
      methods: {
        sendMessage: async (message: string) => {
          // Implementation for Kiro 2.x (hypothetical)
          return await vscode.commands.executeCommand('kiro.chat.send', message);
        },
        getTaskStatus: async (taskId: string) => {
          // Implementation for Kiro 2.x (hypothetical)
          return await vscode.commands.executeCommand('kiro.tasks.getStatus', taskId);
        },
      },
    });
  }

  /**
   * Registers a migration path
   * @param migration Migration path
   */
  registerMigration(migration: MigrationPath): void {
    this.migrationPaths.push(migration);
    this.logger.debug('Registered migration path', {
      component: 'VersionCompatibility',
      from: migration.fromVersion,
      to: migration.toVersion,
    });
  }

  /**
   * Finds migration path between versions
   * @param fromVersion From version
   * @param toVersion To version
   * @returns Migration path or undefined
   */
  findMigrationPath(fromVersion: string, toVersion: string): MigrationPath | undefined {
    return this.migrationPaths.find(
      (m) => m.fromVersion === fromVersion && m.toVersion === toVersion
    );
  }

  /**
   * Executes migration
   * @param migration Migration path
   * @returns Whether migration was successful
   */
  async executeMigration(migration: MigrationPath): Promise<boolean> {
    try {
      this.logger.info('Executing migration', {
        component: 'VersionCompatibility',
        from: migration.fromVersion,
        to: migration.toVersion,
      });

      for (const step of migration.steps) {
        try {
          this.logger.debug(`Executing migration step: ${step.description}`, {
            component: 'VersionCompatibility',
          });

          await step.execute();
        } catch (error) {
          this.logger.error(`Migration step failed: ${step.description}`, {
            component: 'VersionCompatibility',
            error: (error as Error).message,
          });

          if (step.required) {
            return false;
          }
        }
      }

      this.logger.info('Migration completed successfully', {
        component: 'VersionCompatibility',
      });

      return true;
    } catch (error) {
      this.logger.error('Migration failed', {
        component: 'VersionCompatibility',
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Gets Kiro version
   * @returns Kiro version or undefined
   */
  getKiroVersion(): VersionInfo | undefined {
    return this.kiroVersion;
  }

  /**
   * Gets extension version
   * @returns Extension version
   */
  getExtensionVersion(): VersionInfo {
    return this.extensionVersion;
  }

  /**
   * Checks if a specific version is compatible
   * @param version Version to check
   * @returns Whether version is compatible
   */
  isVersionCompatible(version: string): boolean {
    try {
      const minVersion = '1.0.0';
      return SemverUtils.gte(version, minVersion);
    } catch {
      return false;
    }
  }
}
