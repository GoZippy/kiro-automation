# Distribution Guide

This document describes how to package and distribute the Kiro Automation Extension.

## Overview

The extension is distributed through:
1. **VS Code Marketplace** - Primary distribution channel
2. **GitHub Releases** - VSIX files for manual installation
3. **Direct Installation** - From source for development

## Prerequisites

### Required Tools
- Node.js 18+ and npm 8+
- Git
- VS Code 1.85.0+
- @vscode/vsce (installed as dev dependency)

### Required Accounts
- **GitHub Account** - For repository and releases
- **Azure DevOps Account** - For VS Code Marketplace publishing
  - Create at: https://dev.azure.com
  - Generate Personal Access Token (PAT) with Marketplace (Manage) scope

### Environment Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Secrets** (for CI/CD)
   - Add `VSCE_PAT` to GitHub repository secrets
   - Go to: Settings → Secrets and variables → Actions → New repository secret

## Package Structure

```
kiro-automation-extension/
├── package.json              # Extension manifest
├── README.md                 # Marketplace description
├── CHANGELOG.md              # Version history
├── LICENSE                   # MIT License
├── VERSIONING.md            # Versioning guide
├── DISTRIBUTION.md          # This file
├── .vscodeignore            # Files to exclude from package
├── resources/               # Static resources
│   └── icon.png            # Extension icon (128x128+)
├── scripts/                 # Build and release scripts
│   ├── build.js            # Main build script
│   ├── version-bump.js     # Version management
│   ├── pre-publish.js      # Pre-publish validation
│   └── prepare-release.js  # Release preparation
├── .github/
│   └── workflows/          # CI/CD workflows
│       ├── ci.yml          # Continuous integration
│       ├── release.yml     # Marketplace publishing
│       ├── pr-checks.yml   # Pull request validation
│       └── dependency-update.yml  # Automated updates
└── dist/                   # Build output (gitignored)
    └── *.vsix             # Packaged extension
```

## Building

### Development Build

Quick build for testing:
```bash
npm run compile
```

### Production Build

Full build with validation:
```bash
npm run build
```

This runs:
1. Clean old artifacts
2. Lint code
3. Compile TypeScript
4. Run tests
5. Package extension

### Quick Build

Skip tests and linting:
```bash
npm run build:quick
```

## Packaging

### Create VSIX Package

```bash
npm run package
```

Output: `dist/kiro-automation-extension-{version}.vsix`

### Validate Package

Before publishing, validate the package:
```bash
npm run validate
```

This checks:
- Required files present
- package.json completeness
- CHANGELOG.md updated
- Icon file exists
- Compiled output present
- Version format valid

## Versioning

### Version Numbering

We follow [Semantic Versioning](https://semver.org/):
- **MAJOR.MINOR.PATCH** (e.g., 1.2.3)
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward-compatible)
- **PATCH**: Bug fixes (backward-compatible)

### Bump Version

Use npm scripts to bump version:

```bash
# Patch release (0.1.0 → 0.1.1)
npm run version:patch

# Minor release (0.1.0 → 0.2.0)
npm run version:minor

# Major release (0.1.0 → 1.0.0)
npm run version:major
```

This automatically:
1. Updates package.json
2. Creates CHANGELOG.md section
3. Commits changes

### Update CHANGELOG

After version bump, edit CHANGELOG.md to add release notes:

```markdown
## [0.2.0] - 2024-10-25

### Added
- New feature X

### Fixed
- Bug Y
```

## Release Process

### Automated Release (Recommended)

1. **Prepare Release**
   ```bash
   npm run prepare-release
   ```
   This checks all requirements and shows what needs to be done.

2. **Bump Version**
   ```bash
   npm run version:minor
   ```

3. **Update CHANGELOG.md**
   Edit the file to add detailed release notes.

4. **Commit Changes**
   ```bash
   git add .
   git commit -m "chore: prepare release v0.2.0"
   git push origin main
   ```

5. **Create and Push Tag**
   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```

6. **Monitor Release**
   - GitHub Actions automatically builds and publishes
   - Check: https://github.com/kiro/kiro-automation-extension/actions
   - Workflow creates GitHub release with VSIX file

### Manual Release

If automated release fails or for testing:

1. **Build Package**
   ```bash
   npm run build
   ```

2. **Validate**
   ```bash
   npm run validate
   ```

3. **Publish to Marketplace**
   ```bash
   npm run publish:marketplace
   ```
   Requires `VSCE_PAT` environment variable.

4. **Create GitHub Release**
   - Go to: https://github.com/kiro/kiro-automation-extension/releases/new
   - Tag: v{version}
   - Title: Release v{version}
   - Description: Copy from CHANGELOG.md
   - Attach: dist/*.vsix file

## Distribution Channels

### VS Code Marketplace

**URL**: https://marketplace.visualstudio.com/items?itemName=kiro.kiro-automation-extension

**Installation**:
1. Open VS Code
2. Extensions view (Ctrl+Shift+X)
3. Search "Kiro Automation Extension"
4. Click Install

**Publishing**:
- Automated via GitHub Actions on tag push
- Manual: `npm run publish:marketplace`

**Requirements**:
- Valid publisher account
- Personal Access Token (PAT)
- All validation checks pass

### GitHub Releases

**URL**: https://github.com/kiro/kiro-automation-extension/releases

**Installation**:
1. Download .vsix file from release
2. VS Code → Extensions → "..." → Install from VSIX
3. Select downloaded file

**Publishing**:
- Automated via GitHub Actions
- Creates release with VSIX attachment

### Direct Installation

For development or testing:

1. **Clone Repository**
   ```bash
   git clone https://github.com/kiro/kiro-automation-extension.git
   cd kiro-automation-extension
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Build**
   ```bash
   npm run compile
   ```

4. **Run in Development**
   - Open in VS Code
   - Press F5 to launch Extension Development Host

## CI/CD Pipeline

### Workflows

1. **CI (ci.yml)**
   - Triggers: Push to main/develop, Pull Requests
   - Runs: Tests, linting, build on multiple platforms
   - Artifacts: Test results, VSIX package

2. **Release (release.yml)**
   - Triggers: Git tags (v*.*.*)
   - Runs: Build, validate, publish to marketplace
   - Creates: GitHub release with VSIX

3. **PR Checks (pr-checks.yml)**
   - Triggers: Pull requests
   - Runs: Validation, tests, bundle size check
   - Comments: Results on PR

4. **Dependency Updates (dependency-update.yml)**
   - Triggers: Weekly schedule, manual
   - Runs: Update dependencies, security audit
   - Creates: PR with updates or issue for vulnerabilities

### Status Badges

Add to README.md:
```markdown
![CI](https://github.com/kiro/kiro-automation-extension/workflows/CI/badge.svg)
![Release](https://github.com/kiro/kiro-automation-extension/workflows/Release/badge.svg)
```

## Troubleshooting

### Build Fails

**Issue**: TypeScript compilation errors
**Solution**: 
```bash
npm run clean
npm install
npm run compile
```

### Package Too Large

**Issue**: VSIX file > 50MB
**Solution**:
- Check .vscodeignore excludes node_modules
- Remove unnecessary files
- Optimize resources

### Publishing Fails

**Issue**: Authentication error
**Solution**:
- Verify VSCE_PAT is valid
- Check token has Marketplace (Manage) scope
- Regenerate token if expired

**Issue**: Version already exists
**Solution**:
- Bump version: `npm run version:patch`
- Ensure tag doesn't exist: `git tag -l`

### Validation Fails

**Issue**: Missing required files
**Solution**:
- Run: `npm run prepare-release`
- Fix issues listed
- Ensure all files in package.json

## Best Practices

### Before Release

- [ ] All tests pass
- [ ] No linting errors
- [ ] CHANGELOG.md updated
- [ ] Version bumped correctly
- [ ] README.md accurate
- [ ] Breaking changes documented
- [ ] Manual testing completed

### Release Checklist

- [ ] Run `npm run prepare-release`
- [ ] Fix any issues found
- [ ] Update CHANGELOG.md with details
- [ ] Commit all changes
- [ ] Create and push tag
- [ ] Monitor CI/CD pipeline
- [ ] Verify marketplace listing
- [ ] Test installation from marketplace

### Post-Release

- [ ] Verify extension installs correctly
- [ ] Check marketplace page
- [ ] Monitor for issues
- [ ] Respond to user feedback
- [ ] Plan next release

## Resources

- [VS Code Extension Publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [vsce CLI Documentation](https://github.com/microsoft/vscode-vsce)
- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [GitHub Actions](https://docs.github.com/en/actions)

## Support

For issues with distribution:
- Check [GitHub Issues](https://github.com/kiro/kiro-automation-extension/issues)
- Review [CI/CD logs](https://github.com/kiro/kiro-automation-extension/actions)
- Contact maintainers

## License

This extension is licensed under the MIT License. See [LICENSE](LICENSE) file.
