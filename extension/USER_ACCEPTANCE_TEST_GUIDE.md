# User Acceptance Testing Guide

This guide provides step-by-step instructions for performing user acceptance testing (UAT) on the Kiro Automation Extension.

## Prerequisites

- VS Code 1.85.0 or higher installed
- Kiro IDE extension installed and active
- Node.js 18.0 or higher (for development testing)
- Test workspace prepared

## Test Environment Setup

### 1. Create Test Workspace

```bash
mkdir kiro-automation-test
cd kiro-automation-test
mkdir -p .kiro/specs/test-feature
```

### 2. Create Sample Spec Files

Create `.kiro/specs/test-feature/requirements.md`:

```markdown
# Test Feature Requirements

## Requirement 1.1
The system shall process test data

## Requirement 1.2
The system shall validate inputs

## Requirement 2.1
The system shall generate outputs
```

Create `.kiro/specs/test-feature/design.md`:

```markdown
# Test Feature Design

## Overview
Simple test feature for UAT

## Components
- Data processor
- Input validator
- Output generator
```

Create `.kiro/specs/test-feature/tasks.md`:

```markdown
# Test Feature Tasks

- [ ] 1. Setup test environment
  - Initialize configuration
  - Verify dependencies
  - _Requirements: 1.1_

- [ ] 2. Implement core functionality
  - [ ] 2.1 Create data processor
    - Implement processing logic
    - _Requirements: 1.1_
  
  - [ ] 2.2 Add input validation
    - Validate data types
    - _Requirements: 1.2_
  
  - [ ]* 2.3 Add optional logging
    - Log processing steps
    - _Requirements: 1.1_

- [ ] 3. Generate outputs
  - Create output files
  - _Requirements: 2.1_
```

## Test Scenarios

### Scenario 1: Basic Automation Flow

**Objective**: Verify basic automation workflow

**Steps**:
1. Open test workspace in VS Code
2. Verify Kiro Automation extension is active
3. Open Command Palette (`Ctrl+Shift+P`)
4. Run: `Kiro Automation: Start`
5. Observe automation progress

**Expected Results**:
- Extension activates automatically
- Tasks are discovered and displayed in tree view
- Automation starts without errors
- Tasks progress from `[ ]` to `[~]` to `[x]`
- Progress panel shows real-time updates
- Status bar displays current task
- All tasks complete successfully

**Pass Criteria**:
- [ ] Extension activates
- [ ] Tasks discovered
- [ ] Automation completes
- [ ] No errors in logs

### Scenario 2: Task Tree View

**Objective**: Verify task tree view functionality

**Steps**:
1. Open Explorer sidebar
2. Locate "Kiro Automation Tasks" view
3. Expand spec folders
4. Observe task status indicators
5. Click on individual tasks

**Expected Results**:
- Tree view displays all specs
- Tasks show correct status icons
- Clicking task opens tasks.md file
- Status updates in real-time during automation

**Pass Criteria**:
- [ ] Tree view displays correctly
- [ ] Status icons accurate
- [ ] Navigation works
- [ ] Real-time updates

### Scenario 3: Progress Monitoring

**Objective**: Verify progress monitoring features

**Steps**:
1. Start automation
2. Open progress panel: `Kiro Automation: Show Progress Panel`
3. Observe progress updates
4. Check status bar
5. Open logs: `Kiro Automation: Show Logs`

**Expected Results**:
- Progress panel opens in webview
- Shows current task and percentage
- Displays estimated time remaining
- Status bar updates with current task
- Logs show detailed execution information

**Pass Criteria**:
- [ ] Progress panel works
- [ ] Percentage accurate
- [ ] Status bar updates
- [ ] Logs detailed

### Scenario 4: Pause and Resume

**Objective**: Verify pause/resume functionality

**Steps**:
1. Start automation
2. Wait for first task to complete
3. Run: `Kiro Automation: Pause`
4. Verify automation paused
5. Run: `Kiro Automation: Resume`
6. Verify automation continues

**Expected Results**:
- Automation pauses after current task
- Status changes to "Paused"
- Resume continues from next task
- No tasks are lost or duplicated

**Pass Criteria**:
- [ ] Pause works correctly
- [ ] Resume continues properly
- [ ] No data loss
- [ ] State maintained

### Scenario 5: Error Handling

**Objective**: Verify error handling and recovery

**Steps**:
1. Create task with invalid requirements reference
2. Start automation
3. Observe error handling
4. Check retry behavior
5. Verify error notifications

**Expected Results**:
- Error detected and logged
- Retry attempts made (up to configured limit)
- User notified of error
- Option to skip or retry task
- Automation can continue or stop based on configuration

**Pass Criteria**:
- [ ] Errors detected
- [ ] Retry logic works
- [ ] Notifications shown
- [ ] Recovery options available

### Scenario 6: Multi-Workspace Support

**Objective**: Verify multi-workspace functionality

**Steps**:
1. Create multi-root workspace with 2+ folders
2. Add `.kiro/specs/` to each folder
3. Run: `Kiro Automation: Start Concurrent Automation`
4. Observe concurrent execution
5. Switch between workspaces

**Expected Results**:
- Multiple workspaces execute concurrently
- Independent progress tracking per workspace
- Workspace switching works correctly
- No interference between workspaces

**Pass Criteria**:
- [ ] Concurrent execution works
- [ ] Independent tracking
- [ ] Switching functional
- [ ] No conflicts

### Scenario 7: Configuration Management

**Objective**: Verify configuration system

**Steps**:
1. Open Settings (`Ctrl+,`)
2. Search for "Kiro Automation"
3. Modify settings:
   - Change `retryAttempts` to 5
   - Change `timeout` to 600000
   - Enable `skipOptionalTasks`
4. Start automation
5. Verify settings applied

**Expected Results**:
- Settings UI displays all options
- Changes saved correctly
- Settings applied to automation
- Workspace-specific settings override global

**Pass Criteria**:
- [ ] Settings accessible
- [ ] Changes persist
- [ ] Settings applied
- [ ] Overrides work

### Scenario 8: Logging and Export

**Objective**: Verify logging functionality

**Steps**:
1. Run automation session
2. Open logs: `Kiro Automation: Show Logs`
3. Filter logs by level
4. Search logs for specific text
5. Export logs: `Kiro Automation: Export Logs`
6. Verify exported file

**Expected Results**:
- Logs display in output channel
- Filtering works correctly
- Search finds relevant entries
- Export creates valid JSON/CSV file
- Exported data complete and accurate

**Pass Criteria**:
- [ ] Logs display
- [ ] Filtering works
- [ ] Search functional
- [ ] Export successful

### Scenario 9: Performance Monitoring

**Objective**: Verify performance monitoring

**Steps**:
1. Enable performance monitoring in settings
2. Start automation
3. Monitor memory usage
4. Check CPU utilization
5. View performance metrics in progress panel

**Expected Results**:
- Memory usage tracked and displayed
- CPU usage monitored
- Metrics updated in real-time
- Performance alerts if thresholds exceeded
- Memory usage stays under 100MB

**Pass Criteria**:
- [ ] Memory tracked
- [ ] CPU monitored
- [ ] Metrics accurate
- [ ] Alerts work
- [ ] Performance acceptable

### Scenario 10: Session Persistence

**Objective**: Verify session persistence and recovery

**Steps**:
1. Start automation
2. Wait for some tasks to complete
3. Close VS Code (or reload window)
4. Reopen VS Code
5. Check for session recovery prompt
6. Resume session

**Expected Results**:
- Session state saved automatically
- Recovery prompt appears on restart
- Option to resume or start fresh
- Resumed session continues from last task
- Completed tasks not re-executed

**Pass Criteria**:
- [ ] Session saved
- [ ] Recovery prompt shown
- [ ] Resume works
- [ ] State accurate

## Requirements Verification

### Core Requirements (1.x)

- [ ] 1.1: Extension packages as .vsix file
- [ ] 1.2: Activates on .kiro directory detection
- [ ] 1.3: Commands registered in Command Palette
- [ ] 1.4: Activity bar icon present
- [ ] 1.5: Kiro IDE compatibility checked
- [ ] 1.6: Installation status displayed
- [ ] 1.7: Activation errors handled gracefully

### Task Discovery (2.x)

- [ ] 2.1: Scans .kiro/specs/*/tasks.md files
- [ ] 2.2: Parses task status indicators
- [ ] 2.3: Extracts task IDs, titles, subtasks
- [ ] 2.4: Identifies task dependencies
- [ ] 2.5: Detects task file changes
- [ ] 2.6: Validates task file format
- [ ] 2.7: Supports multiple spec directories

### Kiro Integration (3.x)

- [ ] 3.1: Discovers Kiro's internal API
- [ ] 3.2: Authenticates with Kiro
- [ ] 3.3: Sends formatted prompts
- [ ] 3.4: Handles rate limits
- [ ] 3.5: Monitors chat responses
- [ ] 3.6: Supports multiple chat sessions
- [ ] 3.7: Provides fallback mechanisms

### Task Execution (4.x)

- [ ] 4.1: Executes tasks in correct order
- [ ] 4.2: Generates contextual prompts
- [ ] 4.3: Marks tasks in-progress/completed
- [ ] 4.4: Handles task failures with retry
- [ ] 4.5: Skips completed tasks
- [ ] 4.6: Supports pause/resume
- [ ] 4.7: Maintains state across restarts

### UI Components (5.x)

- [ ] 5.1: Progress panel shows current task
- [ ] 5.2: Tree view displays all specs/tasks
- [ ] 5.3: Real-time logs available
- [ ] 5.4: Start/stop/pause/resume controls
- [ ] 5.5: Status bar integration
- [ ] 5.6: Task skip functionality
- [ ] 5.7: Detailed error information

### Configuration (6.x)

- [ ] 6.1: Settings for speed/concurrency
- [ ] 6.2: Retry attempts/timeout configurable
- [ ] 6.3: Enable/disable specs/tasks
- [ ] 6.4: Notification preferences
- [ ] 6.5: Custom prompt templates
- [ ] 6.6: Workspace-specific config
- [ ] 6.7: Configuration validation

### Error Handling (7.x)

- [ ] 7.1: Detects unresponsive Kiro chat
- [ ] 7.2: Exponential backoff for failures
- [ ] 7.3: Manual retry options
- [ ] 7.4: Detailed error logging
- [ ] 7.5: Automatic recovery attempts
- [ ] 7.6: User notifications for errors
- [ ] 7.7: Maintains partial progress

### Completion Detection (8.x)

- [ ] 8.1: Monitors chat for completion
- [ ] 8.2: Verifies file system changes
- [ ] 8.3: Detects requests for input
- [ ] 8.4: Handles ambiguous states
- [ ] 8.5: Implements timeout mechanisms
- [ ] 8.6: Validates task outputs
- [ ] 8.7: Updates status in markdown

### Logging (9.x)

- [ ] 9.1: Logs all activities with timestamps
- [ ] 9.2: Multiple log levels supported
- [ ] 9.3: Saves logs to files
- [ ] 9.4: Includes context information
- [ ] 9.5: Log filtering/search
- [ ] 9.6: Exports logs (JSON/CSV)
- [ ] 9.7: Integrates with output panel

### Performance (10.x)

- [ ] 10.1: Background thread execution
- [ ] 10.2: Memory usage under 100MB
- [ ] 10.3: Efficient file watching
- [ ] 10.4: Throttled API calls
- [ ] 10.5: Resource cleanup
- [ ] 10.6: Performance metrics available
- [ ] 10.7: Graceful degradation

### Multi-Workspace (11.x)

- [ ] 11.1: Multiple workspace folders supported
- [ ] 11.2: Independent configuration per workspace
- [ ] 11.3: Switch between sessions
- [ ] 11.4: Concurrent execution supported
- [ ] 11.5: Workspace-specific progress
- [ ] 11.6: Handles workspace changes
- [ ] 11.7: Persists state per workspace

### Kiro Integration (12.x)

- [ ] 12.1: Integrates with Kiro task system
- [ ] 12.2: Respects Kiro file watching
- [ ] 12.3: Works with manual chat
- [ ] 12.4: Supports Kiro hooks
- [ ] 12.5: Compatible with spec format
- [ ] 12.6: Handles Kiro updates
- [ ] 12.7: Provides migration paths

### Security (13.x)

- [ ] 13.1: Minimal permissions requested
- [ ] 13.2: Secure credential handling
- [ ] 13.3: Input validation
- [ ] 13.4: Security sandbox compliance
- [ ] 13.5: Audit logs available
- [ ] 13.6: Respects workspace trust
- [ ] 13.7: Secure API communication

### Documentation (14.x)

- [ ] 14.1: In-editor help/tooltips
- [ ] 14.2: Comprehensive README
- [ ] 14.3: Troubleshooting guides
- [ ] 14.4: API documentation
- [ ] 14.5: Interactive tutorials
- [ ] 14.6: Context-sensitive help
- [ ] 14.7: Up-to-date documentation

### Extensibility (15.x)

- [ ] 15.1: Plugin hooks for processors
- [ ] 15.2: Custom prompt templates
- [ ] 15.3: Custom completion detection
- [ ] 15.4: Third-party integration APIs
- [ ] 15.5: Custom UI panels
- [ ] 15.6: Custom notifications
- [ ] 15.7: Backward compatibility

## Test Results Template

### Test Session Information
- **Date**: _______________
- **Tester**: _______________
- **VS Code Version**: _______________
- **Extension Version**: _______________
- **OS**: _______________

### Overall Results
- **Total Scenarios**: 10
- **Passed**: ___
- **Failed**: ___
- **Blocked**: ___
- **Not Tested**: ___

### Issues Found
1. **Issue**: _______________
   - **Severity**: Critical / High / Medium / Low
   - **Steps to Reproduce**: _______________
   - **Expected**: _______________
   - **Actual**: _______________

### Recommendations
- _______________
- _______________
- _______________

### Sign-off
- [ ] All critical issues resolved
- [ ] All high-priority issues resolved or documented
- [ ] Extension ready for release

**Tester Signature**: _______________
**Date**: _______________
