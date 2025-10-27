# Build and Packaging Scripts

This directory contains scripts for building, versioning, and publishing the Kiro Automation Extension.

## Scripts

### build.js

Comprehensive build script that handles the complete build process:

```bash
node scripts/build.js
```

Options:
- `--skip-tests`: Skip running tests
- `--skip-lint`: Skip linting

The script performs:
1. Package validation (checks for required files)
2. Cleaning (removes old build artifacts)
3. Linting (ESLint)
4. TypeScript compilation
5. Testing (optional)
6. Packaging (creates .vsix file in dist/)

### version-bump.js

Semantic versioning tool that bumps version and updates changelog:

```bash
node scripts/version-bump.js <patch|minor|major> [--no-commit]
```

Examples:
- `node scripts/version-bump.js patch` - 0.1.0 → 0.1.1
- `node scripts/version-bump.js minor` - 0.1.0 → 0.2.0
- `node scripts/version-bump.js major` - 0.1.0 → 1.0.0

The script:
1. Bumps version in package.json
2. Updates CHANGELOG.md with new version section
3. Commits changes to git (unless --no-commit is used)

### pre-publish.js

Pre-publication validation script that ensures all requirements are met:

```bash
node scripts/pre-publish.js
```

Validates:
- package.json (required and recommended fields)
- README.md (essential sections)
- CHANGELOG.md (includes current version)
- Icon file (if specified)
- LICENSE file
- Compiled output (out/ directory)

## NPM Scripts

These scripts are integrated into package.json:

### Building
- `npm run build` - Full build with validation
- `npm run build:quick` - Quick build (skip tests and lint)
- `npm run compile` - TypeScript compilation only
- `npm run clean` - Remove build artifacts

### Versioning
- `npm run version:patch` - Bump patch version
- `npm run version:minor` - Bump minor version
- `npm run version:major` - Bump major version

### Packaging
- `npm run package` - Create .vsix package
- `npm run validate` - Validate package before publishing

### Publishing
- `npm run publish:marketplace` - Publish to VS Code Marketplace

## Workflow

### Development Build
```bash
npm run compile
npm run watch  # For continuous compilation
```

### Production Build
```bash
npm run build
```

### Release Process
```bash
# 1. Bump version
npm run version:minor

# 2. Update CHANGELOG.md with release notes

# 3. Build and validate
npm run build
npm run validate

# 4. Publish
npm run publish:marketplace
```

## Requirements

- Node.js 16+
- npm 8+
- Git (for version bumping)
- @vscode/vsce (installed as dev dependency)

## Notes

- All scripts use colored console output for better readability
- Build artifacts are placed in `dist/` directory
- Scripts will exit with non-zero code on errors
- Pre-publish validation runs automatically before publishing
