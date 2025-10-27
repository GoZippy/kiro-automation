# Manual Testing Checklist

This checklist is designed for manual testing of the Kiro Automation Extension in a real Kiro environment. Use this to verify functionality that requires human observation and interaction.

## Pre-Testing Setup

### Environment Preparation
- [ ] VS Code version 1.85.0 or higher installed
- [ ] Kiro IDE extension installed and activated
- [ ] Test workspace created with sample specs
- [ ] Extension installed from VSIX or marketplace
- [ ] Extension activated successfully

### Test Data Preparation
- [ ] Created `.kiro/specs/test-feature-1/` with requirements, design, tasks
- [ ] Created `.kiro/specs/test-feature-2/` with requirements, design, tasks
- [ ] Tasks include mix of simple and complex items
- [ ] Tasks include optional items (marked with *)
- [ ] Tasks include subtasks with proper nesting

## Functional Testing

### 1. Extension Activation
- [ ] Extension activates when opening workspace with `.kiro` directory
- [ ] Extension icon appears in activity bar
- [ ] No errors in Developer Console (Help > Toggle Developer Tools)
- [ ] Extension version displayed correctly in Extensions view

### 2. Task Discovery
- [ ] Open "Kiro Automation Tasks" tree view
- [ ] Verify all specs are discovered and listed
- [ ] Verify all tasks are parsed correctly
- [ ] Verify task status indicators are accurate
- [ ] Verify subtasks are nested properly
- [ ] Verify optional tasks are marked correctly

### 3. Command Palette Integration
- [ ] Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
- [ ] Search for "Kiro Automation"
- [ ] Verify all commands are listed:
  - [ ] Kiro Automation: Start
  - [ ] Kiro Automation: Stop
  - [ ] Kiro Automation: Pause
  - [ ] Kiro Automation: Resume
  - [ ] Kiro Automation: Show Progress Panel
  - [ ] Kiro Automation: Show Logs
  - [ ] Kiro Automation: Export Logs
  - [ ] Kiro Automation: Next Task

### 4. Basic Automation Flow
- [ ] Run "Kiro Automation: Start" command
- [ ] Observe automation starting
- [ ] Verify first task marked as in-progress `[~]`
- [ ] Verify prompt sent to Kiro chat
- [ ] Observe Kiro processing the task
- [ ] Verify task marked as complete `[x]` after Kiro finishes
- [ ] Verify automation proceeds to next task
- [ ] Verify all tasks complete successfully

### 5. Progress Monitoring
- [ ] Open progress panel during automation
- [ ] Verify current task displayed
- [ ] Verify progress percentage accurate
- [ ] Verify estimated time remaining shown
- [ ] Verify completed task count accurate
- [ ] Check status bar shows current task
- [ ] Verify status bar updates in real-time

### 6. Pause and Resume
- [ ] Start automation
- [ ] Wait for first task to complete
- [ ] Run "Kiro Automation: Pause" command
- [ ] Verify automation pauses after current task
- [ ] Verify status changes to "Paused"
- [ ] Verify no new tasks start
- [ ] Run "Kiro Automation: Resume" command
- [ ] Verify automation continues from next task
- [ ] Verify no tasks skipped or duplicated

### 7. Stop and Restart
- [ ] Start automation
- [ ] Wait for some tasks to complete
- [ ] Run "Kiro Automation: Stop" command
- [ ] Verify automation stops immediately
- [ ] Verify current task status preserved
- [ ] Restart automation
- [ ] Verify automation resumes from last incomplete task
- [ ] Verify completed tasks not re-executed

### 8. Error Handling
- [ ] Create task with invalid syntax
- [ ] Start automation
- [ ] Verify error detected and logged
- [ ] Verify error notification shown
- [ ] Verify retry attempts made
- [ ] Verify option to skip or retry task
- [ ] Test skipping failed task
- [ ] Test retrying failed task
- [ ] Verify automation continues after error resolution

### 9. Configuration Management
- [ ] Open Settings (Ctrl+, / Cmd+,)
- [ ] Search for "Kiro Automation"
- [ ] Modify settings:
  - [ ] Change retry attempts
  - [ ] Change timeout value
  - [ ] Enable/disable notifications
  - [ ] Change concurrency level
  - [ ] Enable skip optional tasks
- [ ] Verify settings saved
- [ ] Start automation
- [ ] Verify settings applied correctly

### 10. Logging System
- [ ] Run "Kiro Automation: Show Logs" command
- [ ] Verify logs displayed in Output panel
- [ ] Verify log entries have timestamps
- [ ] Verify log entries have context (task ID, spec name)
- [ ] Test log level filtering (if available)
- [ ] Search logs for specific text
- [ ] Run "Kiro Automation: Export Logs" command
- [ ] Verify exported file created
- [ ] Verify exported file contains complete log data

### 11. Multi-Workspace Support
- [ ] Create multi-root workspace with 2+ folders
- [ ] Add `.kiro/specs/` to each folder
- [ ] Verify tasks from all workspaces discovered
- [ ] Start automation on specific workspace
- [ ] Verify only selected workspace tasks execute
- [ ] Test concurrent automation (if supported)
- [ ] Verify independent progress tracking
- [ ] Switch between workspace views

### 12. Session Persistence
- [ ] Start automation
- [ ] Wait for some tasks to complete
- [ ] Close VS Code (or reload window: Ctrl+R / Cmd+R)
- [ ] Reopen VS Code
- [ ] Verify session recovery prompt appears
- [ ] Choose to resume session
- [ ] Verify automation continues from last task
- [ ] Verify completed tasks not re-executed
- [ ] Verify session state accurate

### 13. Task Tree View Interactions
- [ ] Click on task in tree view
- [ ] Verify tasks.md file opens
- [ ] Verify cursor positioned at task line
- [ ] Right-click on task
- [ ] Verify context menu appears (if implemented)
- [ ] Test context menu actions:
  - [ ] Skip task
  - [ ] Retry task
  - [ ] View task details
- [ ] Verify tree view refreshes on task status changes

### 14. Kiro Chat Integration
- [ ] Start automation
- [ ] Open Kiro chat panel
- [ ] Verify prompts appear in chat
- [ ] Verify prompts include task context
- [ ] Verify prompts include requirements references
- [ ] Verify prompts include design context
- [ ] Observe Kiro's response
- [ ] Verify completion detected correctly
- [ ] Verify next task starts automatically

### 15. Performance Monitoring
- [ ] Enable performance monitoring in settings
- [ ] Start automation
- [ ] Open Task Manager / Activity Monitor
- [ ] Monitor VS Code memory usage
- [ ] Verify memory stays under 100MB increase
- [ ] Monitor CPU usage
- [ ] Verify CPU usage reasonable
- [ ] Check for memory leaks (long-running session)
- [ ] Verify performance metrics displayed (if available)

### 16. Notification System
- [ ] Enable notifications in settings
- [ ] Start automation
- [ ] Verify notification on automation start
- [ ] Wait for task completion
- [ ] Verify notification on task completion
- [ ] Trigger an error
- [ ] Verify notification on error
- [ ] Complete automation
- [ ] Verify notification on automation complete
- [ ] Test notification preferences

### 17. Optional Task Handling
- [ ] Create tasks with optional subtasks (marked with *)
- [ ] Enable "Skip Optional Tasks" in settings
- [ ] Start automation
- [ ] Verify optional tasks skipped
- [ ] Disable "Skip Optional Tasks"
- [ ] Start automation
- [ ] Verify optional tasks executed

### 18. File System Monitoring
- [ ] Start automation
- [ ] Manually edit tasks.md file
- [ ] Change task status manually
- [ ] Verify tree view updates automatically
- [ ] Add new task to tasks.md
- [ ] Verify new task appears in tree view
- [ ] Delete task from tasks.md
- [ ] Verify task removed from tree view

### 19. Prompt Generation
- [ ] Review generated prompts in Kiro chat
- [ ] Verify prompts include task title
- [ ] Verify prompts include task description
- [ ] Verify prompts include subtasks
- [ ] Verify prompts reference requirements
- [ ] Verify prompts include design context
- [ ] Verify prompts are clear and actionable
- [ ] Verify prompts follow configured template

### 20. Edge Cases
- [ ] Test with empty spec directory
- [ ] Test with malformed tasks.md file
- [ ] Test with very large task list (100+ tasks)
- [ ] Test with deeply nested subtasks
- [ ] Test with special characters in task titles
- [ ] Test with missing requirements.md file
- [ ] Test with missing design.md file
- [ ] Test with circular task dependencies (if applicable)

## Integration Testing

### Kiro Compatibility
- [ ] Test with latest Kiro version
- [ ] Test with older Kiro versions (if applicable)
- [ ] Verify API compatibility
- [ ] Test with Kiro updates during automation
- [ ] Verify graceful handling of Kiro disconnection
- [ ] Test with multiple Kiro chat sessions

### VS Code Compatibility
- [ ] Test on Windows
- [ ] Test on macOS
- [ ] Test on Linux
- [ ] Test with different VS Code themes
- [ ] Test with other extensions installed
- [ ] Test with workspace trust enabled/disabled

## Usability Testing

### User Experience
- [ ] Extension easy to install
- [ ] Extension easy to configure
- [ ] Commands easy to find
- [ ] UI elements intuitive
- [ ] Error messages helpful
- [ ] Documentation accessible
- [ ] Help system useful
- [ ] Overall experience smooth

### Documentation Review
- [ ] README.md accurate and complete
- [ ] Setup instructions clear
- [ ] Configuration guide helpful
- [ ] Troubleshooting guide useful
- [ ] API documentation accurate (if applicable)
- [ ] Examples working correctly
- [ ] Screenshots up-to-date

## Performance Testing

### Load Testing
- [ ] Test with 10 tasks
- [ ] Test with 50 tasks
- [ ] Test with 100+ tasks
- [ ] Test with multiple specs (10+)
- [ ] Test with large requirements/design files
- [ ] Monitor memory usage throughout
- [ ] Monitor CPU usage throughout
- [ ] Verify no performance degradation

### Stress Testing
- [ ] Run automation for extended period (1+ hour)
- [ ] Test with rapid start/stop cycles
- [ ] Test with rapid pause/resume cycles
- [ ] Test with multiple concurrent sessions
- [ ] Monitor for memory leaks
- [ ] Monitor for resource exhaustion
- [ ] Verify graceful degradation

## Security Testing

### Permission Verification
- [ ] Review requested permissions
- [ ] Verify minimal permissions used
- [ ] Test workspace trust integration
- [ ] Verify secure credential handling
- [ ] Test input validation
- [ ] Verify no sensitive data in logs
- [ ] Test audit log functionality

## Regression Testing

### After Updates
- [ ] Re-run all functional tests
- [ ] Verify existing configurations still work
- [ ] Verify existing sessions can be recovered
- [ ] Verify backward compatibility
- [ ] Test migration paths (if applicable)

## Test Results

### Summary
- **Total Checks**: ___
- **Passed**: ___
- **Failed**: ___
- **Blocked**: ___
- **Not Applicable**: ___

### Critical Issues Found
1. _______________
2. _______________
3. _______________

### Non-Critical Issues Found
1. _______________
2. _______________
3. _______________

### Recommendations
1. _______________
2. _______________
3. _______________

## Sign-off

- [ ] All critical functionality tested
- [ ] All critical issues resolved
- [ ] Documentation verified
- [ ] Performance acceptable
- [ ] Security verified
- [ ] Ready for release

**Tester**: _______________  
**Date**: _______________  
**Signature**: _______________
