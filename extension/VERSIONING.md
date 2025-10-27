# Versioning Guide

This document describes the versioning strategy for the Kiro Automation Extension.

## Semantic Versioning

We follow [Semantic Versioning 2.0.0](https://semver.org/):

```
MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]
```

### Version Components

- **MAJOR** (X.0.0): Breaking changes, incompatible API changes
- **MINOR** (0.X.0): New features, backward-compatible
- **PATCH** (0.0.X): Bug fixes, backward-compatible
- **PRERELEASE** (0.0.0-alpha.1): Pre-release versions
- **BUILD** (0.0.0+20241025): Build metadata

## Version Increment Rules

### MAJOR Version (Breaking Changes)

Increment when making incompatible changes:
- Removing or renaming commands
- Changing configuration schema (removing/renaming settings)
- Modifying plugin API in incompatible ways
- Changing file format for task specifications
- Removing support for older VS Code versions

**Example:** 1.0.0 → 2.0.0

### MINOR Version (New Features)

Increment when adding functionality in a backward-compatible manner:
- Adding new commands
- Adding new configuration options
- Adding new features
- Enhancing existing features without breaking changes
- Adding new plugin APIs

**Example:** 0.1.0 → 0.2.0

### PATCH Version (Bug Fixes)

Increment when making backward-compatible bug fixes:
- Fixing bugs
- Performance improvements
- Documentation updates
- Security patches (non-breaking)
- Dependency updates (patch versions)

**Example:** 0.1.0 → 0.1.1

## Pre-release Versions

Use pre-release identifiers for versions not ready for production:

### Alpha (Early Development)
```
0.1.0-alpha.1
0.1.0-alpha.2
```
- Unstable, may have bugs
- API may change
- For internal testing

### Beta (Feature Complete)
```
0.1.0-beta.1
0.1.0-beta.2
```
- Feature complete
- API mostly stable
- For public testing

### Release Candidate
```
0.1.0-rc.1
0.1.0-rc.2
```
- Final testing before release
- No new features
- Only critical bug fixes

## Version Workflow

### 1. Development

Work on features in feature branches:
```bash
git checkout -b feature/new-feature
# Make changes
git commit -m "feat: add new feature"
```

### 2. Version Bump

When ready to release, bump the version:

```bash
# For patch release (bug fixes)
npm run version:patch

# For minor release (new features)
npm run version:minor

# For major release (breaking changes)
npm run version:major
```

This will:
1. Update version in package.json
2. Create a new section in CHANGELOG.md
3. Commit the changes

### 3. Update CHANGELOG

Edit CHANGELOG.md to add release notes:
```markdown
## [0.2.0] - 2024-10-25

### Added
- New feature X
- New feature Y

### Fixed
- Bug fix Z
```

### 4. Commit and Tag

```bash
git add CHANGELOG.md
git commit --amend --no-edit
git push origin main
```

### 5. Create Release Tag

```bash
git tag v0.2.0
git push origin v0.2.0
```

This triggers the release workflow.

## Version Numbering Examples

### Initial Development
- `0.1.0` - First alpha release
- `0.2.0` - Second alpha with new features
- `0.3.0` - Third alpha with more features

### Pre-release Testing
- `0.9.0-beta.1` - First beta
- `0.9.0-beta.2` - Second beta with fixes
- `0.9.0-rc.1` - Release candidate

### Stable Releases
- `1.0.0` - First stable release
- `1.0.1` - Patch release (bug fixes)
- `1.1.0` - Minor release (new features)
- `2.0.0` - Major release (breaking changes)

## Changelog Guidelines

### Format

Follow [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
## [Version] - YYYY-MM-DD

### Added
- New features

### Changed
- Changes to existing functionality

### Deprecated
- Soon-to-be removed features

### Removed
- Removed features

### Fixed
- Bug fixes

### Security
- Security improvements
```

### Writing Good Changelog Entries

**Good:**
```markdown
### Added
- Task filtering by status in tree view (#123)
- Support for custom prompt templates (#145)
```

**Bad:**
```markdown
### Added
- Stuff
- Fixed things
```

### Linking Issues and PRs

Reference GitHub issues and PRs:
```markdown
- Fixed task parsing bug (#42)
- Added new feature (PR #43)
```

## Deprecation Policy

When deprecating features:

1. **Announce in MINOR version:**
   ```markdown
   ### Deprecated
   - `oldCommand` will be removed in v2.0.0, use `newCommand` instead
   ```

2. **Show warnings in code:**
   ```typescript
   vscode.window.showWarningMessage(
     'oldCommand is deprecated and will be removed in v2.0.0'
   );
   ```

3. **Remove in next MAJOR version:**
   ```markdown
   ### Removed
   - `oldCommand` (deprecated in v1.5.0)
   ```

## Version Compatibility

### VS Code Engine

Specify minimum VS Code version in package.json:
```json
{
  "engines": {
    "vscode": "^1.85.0"
  }
}
```

Update when using new VS Code APIs:
- **PATCH**: No change needed
- **MINOR**: Update if using new APIs
- **MAJOR**: Update if dropping support for older versions

### Node.js Version

Support Node.js versions used by target VS Code versions:
- VS Code 1.85+: Node.js 18.x
- VS Code 1.90+: Node.js 20.x

## Release Checklist

Before releasing:

- [ ] All tests pass
- [ ] Version bumped correctly
- [ ] CHANGELOG.md updated
- [ ] README.md updated (if needed)
- [ ] Documentation updated
- [ ] Breaking changes documented
- [ ] Migration guide written (for MAJOR versions)
- [ ] Pre-publish validation passes
- [ ] Extension tested manually

## Automation

Version management is automated through:

1. **Scripts:**
   - `npm run version:patch`
   - `npm run version:minor`
   - `npm run version:major`

2. **GitHub Actions:**
   - Automatic release on tag push
   - Automated testing before release
   - Marketplace publishing

3. **Pre-publish Validation:**
   - Runs automatically before publishing
   - Checks all required files
   - Validates version format

## Resources

- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [VS Code Extension Publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Conventional Commits](https://www.conventionalcommits.org/)
