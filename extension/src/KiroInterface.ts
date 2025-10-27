import * as vscode from 'vscode';

/**
 * Kiro API interface
 * Represents the discovered Kiro extension API
 */
export interface KiroAPI {
  /** Send a message to Kiro chat */
  sendChatMessage?(message: string): Promise<string>;
  
  /** Get chat history */
  getChatHistory?(): Promise<ChatMessage[]>;
  
  /** Check if Kiro is connected and ready */
  isConnected?(): boolean;
  
  /** Register a response callback */
  onResponse?(callback: (response: string) => void): vscode.Disposable;
  
  /** Version information */
  version?: string;
  
  /** Any additional API methods */
  [key: string]: any;
}

/**
 * Chat message interface
 */
export interface ChatMessage {
  id: string;
  content: string;
  timestamp: Date;
  role: 'user' | 'assistant' | 'system';
}

/**
 * Kiro discovery result
 */
export interface KiroDiscoveryResult {
  /** Whether Kiro was found */
  found: boolean;
  
  /** Kiro version if found */
  version?: string;
  
  /** Available API methods */
  availableMethods: string[];
  
  /** Discovery approach that succeeded */
  approach?: 'extension-api' | 'commands' | 'webview' | 'filesystem';
  
  /** Error message if discovery failed */
  error?: string;
}

/**
 * KiroInterface class
 * Handles discovery and communication with Kiro IDE
 */
export class KiroInterface {
  private kiroExtension?: vscode.Extension<any>;
  private kiroAPI?: KiroAPI;
  private discoveryResult?: KiroDiscoveryResult;
  private responseCallbacks: Array<(response: string) => void> = [];
  private disposables: vscode.Disposable[] = [];

  /**
   * Discovers and initializes connection to Kiro IDE
   * @returns Discovery result with available API information
   */
  async initialize(): Promise<KiroDiscoveryResult> {
    // Try multiple discovery approaches in order of preference
    const approaches = [
      this.discoverViaExtensionAPI.bind(this),
      this.discoverViaCommands.bind(this),
      this.discoverViaWebView.bind(this),
      this.discoverViaFileSystem.bind(this),
    ];

    for (const approach of approaches) {
      try {
        const result = await approach();
        if (result.found) {
          this.discoveryResult = result;
          return result;
        }
      } catch (error) {
        console.error(`Discovery approach failed:`, error);
      }
    }

    // No approach succeeded
    this.discoveryResult = {
      found: false,
      availableMethods: [],
      error: 'Could not discover Kiro IDE API. Ensure Kiro extension is installed and active.',
    };

    return this.discoveryResult;
  }

  /**
   * Approach 1: Discover Kiro via VS Code Extension API
   */
  private async discoverViaExtensionAPI(): Promise<KiroDiscoveryResult> {
    // Try common Kiro extension IDs
    const possibleIds = [
      'kiro.kiro',
      'kiro.kiro-ide',
      'kiro-ai.kiro',
      'kiro-ide.kiro',
    ];

    for (const extensionId of possibleIds) {
      const extension = vscode.extensions.getExtension(extensionId);
      
      if (extension) {
        this.kiroExtension = extension;
        
        // Activate the extension if not already active
        if (!extension.isActive) {
          try {
            await extension.activate();
          } catch (error) {
            console.warn(`Failed to activate Kiro extension ${extensionId}:`, error);
            continue;
          }
        }

        // Get the exported API
        const api = extension.exports;
        this.kiroAPI = api;

        // Discover available methods
        const availableMethods = this.discoverAPIMethods(api);

        return {
          found: true,
          version: extension.packageJSON?.version,
          availableMethods,
          approach: 'extension-api',
        };
      }
    }

    return {
      found: false,
      availableMethods: [],
      error: 'Kiro extension not found via Extension API',
    };
  }

  /**
   * Approach 2: Discover Kiro via VS Code Commands
   */
  private async discoverViaCommands(): Promise<KiroDiscoveryResult> {
    // Get all available commands
    const commands = await vscode.commands.getCommands(true);
    
    // Look for Kiro-related commands
    const kiroCommands = commands.filter(cmd => 
      cmd.toLowerCase().includes('kiro') ||
      cmd.toLowerCase().includes('chat') ||
      cmd.toLowerCase().includes('ai')
    );

    if (kiroCommands.length > 0) {
      return {
        found: true,
        availableMethods: kiroCommands,
        approach: 'commands',
      };
    }

    return {
      found: false,
      availableMethods: [],
      error: 'No Kiro commands found',
    };
  }

  /**
   * Approach 3: Discover Kiro via WebView communication
   */
  private async discoverViaWebView(): Promise<KiroDiscoveryResult> {
    // This approach would involve creating a webview and attempting
    // to communicate with Kiro's webview panels
    // For now, return not found as this requires more investigation
    return {
      found: false,
      availableMethods: [],
      error: 'WebView discovery not yet implemented',
    };
  }

  /**
   * Approach 4: Discover Kiro via file system monitoring
   */
  private async discoverViaFileSystem(): Promise<KiroDiscoveryResult> {
    // Check if .kiro directory exists in workspace
    const workspaceFolders = vscode.workspace.workspaceFolders;
    
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return {
        found: false,
        availableMethods: [],
        error: 'No workspace folders found',
      };
    }

    // Check for .kiro directory
    for (const folder of workspaceFolders) {
      const kiroPath = vscode.Uri.joinPath(folder.uri, '.kiro');
      
      try {
        const stat = await vscode.workspace.fs.stat(kiroPath);
        if (stat.type === vscode.FileType.Directory) {
          return {
            found: true,
            availableMethods: ['filesystem-monitoring'],
            approach: 'filesystem',
          };
        }
      } catch {
        // Directory doesn't exist, continue
      }
    }

    return {
      found: false,
      availableMethods: [],
      error: 'No .kiro directory found in workspace',
    };
  }

  /**
   * Discovers available methods on the Kiro API object
   */
  private discoverAPIMethods(api: any): string[] {
    if (!api) {
      return [];
    }

    const methods: string[] = [];
    
    // Get all properties and methods
    const props = Object.getOwnPropertyNames(api);
    for (const prop of props) {
      try {
        if (typeof api[prop] === 'function') {
          methods.push(prop);
        } else if (typeof api[prop] === 'object' && api[prop] !== null) {
          // Check nested objects (like api.chat.sendMessage)
          const nestedProps = Object.getOwnPropertyNames(api[prop]);
          for (const nestedProp of nestedProps) {
            if (typeof api[prop][nestedProp] === 'function') {
              methods.push(`${prop}.${nestedProp}`);
            }
          }
        }
      } catch {
        // Skip properties that throw errors
      }
    }

    return methods;
  }

  /**
   * Gets the discovery result
   */
  getDiscoveryResult(): KiroDiscoveryResult | undefined {
    return this.discoveryResult;
  }

  /**
   * Checks if Kiro is available and connected
   */
  isAvailable(): boolean {
    return this.discoveryResult?.found ?? false;
  }

  /**
   * Gets the Kiro version
   */
  getVersion(): string | undefined {
    return this.discoveryResult?.version;
  }

  /**
   * Gets available API methods
   */
  getAvailableMethods(): string[] {
    return this.discoveryResult?.availableMethods ?? [];
  }

  /**
   * Gets the discovery approach that succeeded
   */
  getDiscoveryApproach(): string | undefined {
    return this.discoveryResult?.approach;
  }

  /**
   * Gets the Kiro extension instance
   */
  getExtension(): vscode.Extension<any> | undefined {
    return this.kiroExtension;
  }

  /**
   * Gets the Kiro API object
   */
  getAPI(): KiroAPI | undefined {
    return this.kiroAPI;
  }

  /**
   * Attempts to call a method on the Kiro API
   * @param methodPath Method path (e.g., 'sendMessage' or 'chat.sendMessage')
   * @param args Arguments to pass to the method
   * @returns Result of the method call
   */
  async callAPI(methodPath: string, ...args: any[]): Promise<any> {
    if (!this.kiroAPI) {
      throw new Error('Kiro API not available. Call initialize() first.');
    }

    // Parse method path (handle nested paths like 'chat.sendMessage')
    const parts = methodPath.split('.');
    let target: any = this.kiroAPI;
    
    for (let i = 0; i < parts.length - 1; i++) {
      target = target[parts[i]];
      if (!target) {
        throw new Error(`Method path ${methodPath} not found on Kiro API`);
      }
    }

    const methodName = parts[parts.length - 1];
    const method = target[methodName];

    if (typeof method !== 'function') {
      throw new Error(`${methodPath} is not a function on Kiro API`);
    }

    return await method.apply(target, args);
  }

  /**
   * Attempts to execute a VS Code command
   * @param command Command to execute
   * @param args Arguments to pass to the command
   * @returns Result of the command execution
   */
  async executeCommand(command: string, ...args: any[]): Promise<any> {
    try {
      return await vscode.commands.executeCommand(command, ...args);
    } catch (error) {
      throw new Error(`Failed to execute command ${command}: ${error}`);
    }
  }

  /**
   * Checks if a specific API method is available
   * @param methodPath Method path to check
   * @returns True if the method is available
   */
  hasMethod(methodPath: string): boolean {
    return this.getAvailableMethods().includes(methodPath);
  }

  /**
   * Checks if a specific command is available
   * @param command Command to check
   * @returns True if the command is available
   */
  async hasCommand(command: string): Promise<boolean> {
    const commands = await vscode.commands.getCommands(true);
    return commands.includes(command);
  }

  /**
   * Creates a fallback mechanism for different Kiro versions
   * @param preferredMethod Preferred method to try first
   * @param fallbackMethods Fallback methods to try if preferred fails
   * @param args Arguments to pass to the method
   * @returns Result of the first successful method call
   */
  async callWithFallback(
    preferredMethod: string,
    fallbackMethods: string[],
    ...args: any[]
  ): Promise<any> {
    const methods = [preferredMethod, ...fallbackMethods];
    
    for (const method of methods) {
      try {
        if (this.hasMethod(method)) {
          return await this.callAPI(method, ...args);
        }
      } catch (error) {
        console.warn(`Method ${method} failed, trying next fallback:`, error);
      }
    }

    throw new Error(`All methods failed: ${methods.join(', ')}`);
  }

  /**
   * Disposes of resources
   */
  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    this.responseCallbacks = [];
  }
}

/**
 * Creates and initializes a KiroInterface instance
 * @returns Initialized KiroInterface
 */
export async function createKiroInterface(): Promise<KiroInterface> {
  const kiroInterface = new KiroInterface();
  await kiroInterface.initialize();
  return kiroInterface;
}
