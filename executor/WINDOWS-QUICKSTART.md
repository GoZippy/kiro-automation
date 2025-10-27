# Windows Quick Start Guide

## 🚀 Three Ways to Run on Windows

### Method 1: PowerShell (Recommended) ⭐

1. Open PowerShell in this directory
2. Run:
   ```powershell
   .\Start-Automation.ps1
   ```

If you get an execution policy error, run this first:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

### Method 2: Command Prompt

1. Open Command Prompt in this directory
2. Run:
   ```cmd
   start.bat
   ```

### Method 3: Direct Node.js

1. Open any terminal (PowerShell, CMD, or Git Bash)
2. Run:
   ```bash
   node autonomous-executor.js
   ```

## 📋 Common Commands

### Run Everything
```powershell
.\Start-Automation.ps1
```

### Run Single Spec
```powershell
.\Start-Automation.ps1 -Spec sentiment-moderation-service
```

### Resume After Interruption
```powershell
.\Start-Automation.ps1 -Resume
```

### Get Help
```powershell
.\Start-Automation.ps1 -Help
```

## 🔧 Troubleshooting

### PowerShell Script Won't Run

**Error:** "cannot be loaded because running scripts is disabled"

**Solution:**
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Then run the script again.

### Window Closes Immediately

**Problem:** The batch file or PowerShell script closes too fast

**Solution:** Use the PowerShell script instead:
```powershell
.\Start-Automation.ps1
```

It will keep the window open and show you what's happening.

### Node.js Not Found

**Error:** "node is not recognized"

**Solution:**
1. Install Node.js from https://nodejs.org/
2. Restart your terminal
3. Verify with: `node --version`

## 📊 Monitor Progress

### View Logs in Real-Time
```powershell
Get-Content execution.log -Wait -Tail 50
```

### Check Current State
```powershell
Get-Content execution-state.json | ConvertFrom-Json | Format-List
```

### See Task Status
```powershell
Get-Content ..\specs\*\tasks.md | Select-String "\[x\]|\[~\]|\[ \]"
```

## 🎯 Quick Examples

### Example 1: First Time Running
```powershell
cd K:\Projects\ZippyGameAdmin\.kiro\automation
.\Start-Automation.ps1
```

### Example 2: Run Just the Trivia Game
```powershell
.\Start-Automation.ps1 -Spec zippy-trivia-show
```

### Example 3: Resume After Stopping
```powershell
.\Start-Automation.ps1 -Resume
```

## 💡 Pro Tips for Windows

1. **Use PowerShell ISE** - Better for long-running scripts
2. **Pin to Taskbar** - Right-click PowerShell and pin it
3. **Use Windows Terminal** - Modern terminal with tabs
4. **Run as Administrator** - If you get permission errors
5. **Keep Window Open** - The scripts now pause at the end

## 🔍 File Locations

All files are in: `K:\Projects\ZippyGameAdmin\.kiro\automation\`

- `Start-Automation.ps1` - PowerShell launcher (recommended)
- `start.bat` - Batch file launcher
- `autonomous-executor.js` - Main executor
- `execution-state.json` - Progress tracking
- `execution.log` - Detailed logs

## ⚡ Keyboard Shortcuts

- `Ctrl+C` - Stop execution (progress is saved)
- `Ctrl+L` - Clear screen
- `Tab` - Auto-complete file names
- `↑` - Previous command

## 🎬 Ready to Start?

```powershell
.\Start-Automation.ps1
```

That's it! The automation will handle everything else. 🎉

## 📞 Still Having Issues?

1. Make sure you're in the right directory:
   ```powershell
   cd K:\Projects\ZippyGameAdmin\.kiro\automation
   ```

2. Check Node.js is installed:
   ```powershell
   node --version
   ```

3. Try running directly:
   ```powershell
   node autonomous-executor.js --help
   ```

4. Check the logs:
   ```powershell
   Get-Content execution.log
   ```
