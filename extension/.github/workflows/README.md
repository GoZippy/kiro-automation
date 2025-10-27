# GitHub Actions Workflows

This directory contains CI/CD workflows for the Kiro Automation Extension.

## Workflows

### ci.yml - Continuous Integration

**Triggers:** Push to main/develop, Pull Requests

**Jobs:**
- **test**: Runs tests on multiple OS (Ubuntu, Windows, macOS) and Node versions (18.x, 20.x)
- **build**: Builds the extension and creates VSIX package
- **code-quality**: Runs ESLint, security audit, and dependency checks
- **security**: Scans for vulnerabilities using Trivy

**Artifacts:**
- Test results and coverage reports
- VSIX package (30-day retention)

### release.yml - Release to Marketplace

**Triggers:** Git tags matching `v*.*.*` (e.g., v0.1.0)

**Jobs:**
- **build-and-publish**: Validates, builds, and publishes to VS Code Marketplace
- **notify**: Sends success notification

**Requirements:**
- `VSCE_PAT` secret must be configured (VS Code Marketplace Personal Access Token)

**Process:**
1. Validates version matches tag
2. Runs pre-publish validation
3. Builds extension
4. Publishes to marketplace
5. Creates GitHub release with VSIX attachment

### pr-checks.yml - Pull Request Validation

**Triggers:** Pull request opened, synchronized, or reopened

**Jobs:**
- **validate-pr**: Comprehensive PR validation
  - Checks package-lock.json consistency
  - Runs linting and formatting checks
  - Compiles TypeScript
  - Runs tests with coverage
  - Validates package
  - Checks bundle size
- **compatibility-check**: Verifies VS Code engine compatibility
- **changelog-check**: Reminds to update CHANGELOG.md
- **comment-pr**: Posts results as PR comment

### dependency-update.yml - Automated Dependency Management

**Triggers:** 
- Weekly schedule (Mondays at 9 AM UTC)
- Manual workflow dispatch

**Jobs:**
- **update-dependencies**: 
  - Checks for outdated dependencies
  - Updates to latest compatible versions
  - Runs tests
  - Creates PR with updates
- **security-audit**:
  - Runs npm audit
  - Creates issue if vulnerabilities found

## Setup Instructions

### 1. Configure Secrets

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

- `VSCE_PAT`: Personal Access Token for VS Code Marketplace
  - Create at: https://dev.azure.com/[your-org]/_usersSettings/tokens
  - Scopes: Marketplace (Manage)

### 2. Enable Workflows

Workflows are automatically enabled when pushed to the repository.

### 3. Branch Protection

Recommended branch protection rules for `main`:

- Require pull request reviews
- Require status checks to pass:
  - `test`
  - `build`
  - `validate-pr`
- Require branches to be up to date
- Require linear history

## Usage

### Running CI on Push

Simply push to `main` or `develop` branches:

```bash
git push origin main
```

### Creating a Release

1. Update version in package.json:
   ```bash
   npm run version:minor
   ```

2. Push changes and create tag:
   ```bash
   git push origin main
   git push origin v0.2.0
   ```

3. Workflow automatically publishes to marketplace

### Manual Workflow Trigger

Some workflows support manual triggering:

1. Go to Actions tab in GitHub
2. Select workflow (e.g., "Dependency Updates")
3. Click "Run workflow"
4. Select branch and click "Run workflow"

## Workflow Status Badges

Add these badges to your README.md:

```markdown
![CI](https://github.com/kiro/kiro-automation-extension/workflows/CI/badge.svg)
![Release](https://github.com/kiro/kiro-automation-extension/workflows/Release/badge.svg)
```

## Troubleshooting

### Workflow Fails on Test

- Check test logs in Actions tab
- Run tests locally: `npm test`
- Ensure all dependencies are installed: `npm ci`

### Release Workflow Fails

- Verify `VSCE_PAT` secret is configured
- Check version in package.json matches tag
- Ensure CHANGELOG.md is updated
- Run validation locally: `npm run validate`

### PR Checks Fail

- Run checks locally before pushing:
  ```bash
  npm run lint
  npm run format
  npm test
  npm run validate
  ```

## Maintenance

### Updating Workflow Dependencies

Workflows use GitHub Actions from marketplace. Update versions periodically:

- `actions/checkout@v4`
- `actions/setup-node@v4`
- `actions/upload-artifact@v4`
- `softprops/action-gh-release@v1`

### Modifying Workflows

1. Edit workflow files in `.github/workflows/`
2. Test changes in a feature branch
3. Create PR to review changes
4. Merge to main after approval

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [VS Code Extension Publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [vsce CLI Documentation](https://github.com/microsoft/vscode-vsce)
