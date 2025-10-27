# Release Checklist

This checklist should be completed before releasing a new version of the Kiro Automation Extension.

## Pre-Release Testing

### Integration Testing
- [x] All integration tests pass
- [x] Full system integration test completed
- [x] Error handling verified across components
- [x] Performance metrics within acceptable ranges

### User Acceptance Testing
- [ ] Test with sample projects
  - [ ] Create test workspace with `.kiro/specs/` structure
  - [ ] Add sample tasks.md files
  - [ ] Run automation on sample project
  - [ ] Verify all tasks execute correctly
  
- [ ] Test all commands
  - [ ] Start automation
  - [ ] Stop automation
  - [ ] Pause/Resume automation
  - [ ] Show progress panel
  - [ ] Show logs
  - [ ] Export logs
  - [ ] Refresh tasks
  
- [ ] Test UI components
  - [ ] Task tree view displays correctly
  - [ ] Progress panel updates in real-time
  - [ ] Status bar shows correct information
  - [ ] Notifications appear as expected
  
- [ ] Test error scenarios
  - [ ] Network errors handled gracefully
  - [ ] Timeout errors trigger retry
  - [ ] Invalid task files show helpful errors
  - [ ] Kiro IDE disconnection handled
  
- [ ] Test multi-workspace support
  - [ ] Multiple workspaces can run concurrently
  - [ ] Workspace switching works correctly
  - [ ] Independent configuration per workspace
  
- [ ] Verify all requirements met
  - [ ] Review requirements.md
  - [ ] Check each requirement has corresponding implementation
  - [ ] Verify acceptance criteria satisfied

### Performance Testing
- [x] Memory usage under 100MB during normal operation
- [x] CPU usage reasonable (< 80% sustained)
- [x] Startup time optimized
- [x] File watching efficient with debouncing
- [x] Task caching working correctly

### Documentation Review
- [x] README.md updated and accurate
- [x] API.md complete with examples
- [x] CHANGELOG.md updated with new version
- [x] All code examples tested and working
- [x] Configuration options documented

## Release Preparation

### Version Management
- [ ] Update version in package.json
- [ ] Update version in CHANGELOG.md
- [ ] Create git tag for version
- [ ] Update version compatibility notes

### Build and Package
- [ ] Clean build: `npm run clean && npm run compile`
- [ ] Run all tests: `npm test`
- [ ] Run linter: `npm run lint`
- [ ] Fix any linting issues
- [ ] Package extension: `vsce package`
- [ ] Verify .vsix file created successfully

### Release Notes
- [ ] Create release notes in CHANGELOG.md
- [ ] List new features
- [ ] List bug fixes
- [ ] List breaking changes (if any)
- [ ] List known issues
- [ ] Add upgrade instructions

### Clean Environment Testing
- [ ] Test on fresh VS Code installation
- [ ] Test on Windows
- [ ] Test on macOS
- [ ] Test on Linux
- [ ] Verify extension activates correctly
- [ ] Verify all features work in clean environment

### Marketplace Preparation
- [ ] Update marketplace description
- [ ] Update screenshots (if needed)
- [ ] Update categories and tags
- [ ] Verify icon displays correctly
- [ ] Check license information

## Release Process

### Publishing
- [ ] Login to marketplace: `vsce login <publisher>`
- [ ] Publish extension: `vsce publish`
- [ ] Verify extension appears in marketplace
- [ ] Test installation from marketplace
- [ ] Verify marketplace page displays correctly

### Post-Release
- [ ] Create GitHub release
- [ ] Attach .vsix file to GitHub release
- [ ] Update documentation links
- [ ] Announce release (if applicable)
- [ ] Monitor for issues
- [ ] Respond to user feedback

## Rollback Plan

If critical issues are discovered after release:

1. Unpublish version: `vsce unpublish <publisher>.<extension>@<version>`
2. Fix critical issues
3. Increment patch version
4. Re-test thoroughly
5. Republish with fixes

## Version History

### Version 1.0.0 (Planned)
- Initial release
- Full automation engine
- Task management
- Kiro IDE integration
- Multi-workspace support
- Performance monitoring
- Comprehensive logging
- Plugin system

## Notes

- Always test on clean environment before release
- Keep CHANGELOG.md updated with each release
- Follow semantic versioning (MAJOR.MINOR.PATCH)
- Tag releases in git for version tracking
- Monitor marketplace reviews and issues after release
