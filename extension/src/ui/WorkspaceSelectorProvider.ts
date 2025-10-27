import * as vscode from 'vscode';

/**
 * Workspace selector item for tree view
 */
export class WorkspaceSelectorItem extends vscode.TreeItem {
  constructor(
    public readonly workspaceUri: string,
    public readonly workspaceName: string,
    public readonly isActive: boolean,
    public readonly hasOverrides: boolean,
    public readonly automationActive: boolean
  ) {
    super(workspaceName, vscode.TreeItemCollapsibleState.None);

    this.tooltip = this.buildTooltip();
    this.description = this.buildDescription();
    this.iconPath = this.getIcon();
    this.contextValue = 'workspace';

    // Add command to switch workspace
    this.command = {
      command: 'kiro-automation.selectWorkspace',
      title: 'Select Workspace',
      arguments: [workspaceUri],
    };
  }

  private buildTooltip(): string {
    const parts: string[] = [
      `Workspace: ${this.workspaceName}`,
      `URI: ${this.workspaceUri}`,
    ];

    if (this.isActive) {
      parts.push('Status: Active');
    }

    if (this.hasOverrides) {
      parts.push('Has configuration overrides');
    }

    if (this.automationActive) {
      parts.push('Automation: Running');
    }

    return parts.join('\n');
  }

  private buildDescription(): string {
    const parts: string[] = [];

    if (this.isActive) {
      parts.push('$(check) Active');
    }

    if (this.automationActive) {
      parts.push('$(play) Running');
    }

    if (this.hasOverrides) {
      parts.push('$(gear) Custom');
    }

    return parts.join(' ');
  }

  private getIcon(): vscode.ThemeIcon {
    if (this.automationActive) {
      return new vscode.ThemeIcon('play-circle', new vscode.ThemeColor('charts.green'));
    }

    if (this.isActive) {
      return new vscode.ThemeIcon('folder-active', new vscode.ThemeColor('charts.blue'));
    }

    return new vscode.ThemeIcon('folder');
  }
}

/**
 * Workspace selector tree data provider
 * Displays available workspaces and allows switching between them
 */
export class WorkspaceSelectorProvider implements vscode.TreeDataProvider<WorkspaceSelectorItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<WorkspaceSelectorItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private activeWorkspaceUri?: string;
  private workspaceOverrides = new Map<string, boolean>();
  private automationStatus = new Map<string, boolean>();

  constructor() {}

  /**
   * Refreshes the tree view
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Sets the active workspace
   * @param workspaceUri Workspace URI
   */
  setActiveWorkspace(workspaceUri: string): void {
    this.activeWorkspaceUri = workspaceUri;
    this.refresh();
  }

  /**
   * Sets workspace override status
   * @param workspaceUri Workspace URI
   * @param hasOverrides Whether workspace has configuration overrides
   */
  setWorkspaceOverrides(workspaceUri: string, hasOverrides: boolean): void {
    this.workspaceOverrides.set(workspaceUri, hasOverrides);
    this.refresh();
  }

  /**
   * Sets workspace automation status
   * @param workspaceUri Workspace URI
   * @param isActive Whether automation is active
   */
  setAutomationStatus(workspaceUri: string, isActive: boolean): void {
    this.automationStatus.set(workspaceUri, isActive);
    this.refresh();
  }

  /**
   * Gets tree item for an element
   * @param element Tree item element
   * @returns Tree item
   */
  getTreeItem(element: WorkspaceSelectorItem): vscode.TreeItem {
    return element;
  }

  /**
   * Gets children for an element
   * @param element Parent element (undefined for root)
   * @returns Array of child elements
   */
  getChildren(element?: WorkspaceSelectorItem): Thenable<WorkspaceSelectorItem[]> {
    if (element) {
      // No children for workspace items
      return Promise.resolve([]);
    }

    // Get workspace folders
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
      return Promise.resolve([]);
    }

    // Create workspace items
    const items = workspaceFolders.map((folder) => {
      const uri = folder.uri.toString();
      const isActive = uri === this.activeWorkspaceUri;
      const hasOverrides = this.workspaceOverrides.get(uri) ?? false;
      const automationActive = this.automationStatus.get(uri) ?? false;

      return new WorkspaceSelectorItem(
        uri,
        folder.name,
        isActive,
        hasOverrides,
        automationActive
      );
    });

    return Promise.resolve(items);
  }

  /**
   * Gets parent for an element
   * @param _element Child element
   * @returns Parent element or undefined
   */
  getParent(_element: WorkspaceSelectorItem): vscode.ProviderResult<WorkspaceSelectorItem> {
    return undefined;
  }
}
