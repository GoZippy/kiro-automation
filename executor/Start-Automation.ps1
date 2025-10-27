# Kiro Task Automation Launcher for PowerShell
# Run this with: .\Start-Automation.ps1

param(
    [string]$Spec = "",
    [switch]$Resume = $false,
    [switch]$Help = $false
)

Write-Host ""
Write-Host "🚀 Kiro Task Automation System" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed. Please install Node.js 14+ first." -ForegroundColor Red
    Write-Host "   Download from: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Show help
if ($Help) {
    Write-Host "Usage: .\Start-Automation.ps1 [options]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -Spec <name>    Execute only the specified spec"
    Write-Host "  -Resume         Resume from last checkpoint"
    Write-Host "  -Help           Show this help message"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\Start-Automation.ps1"
    Write-Host "  .\Start-Automation.ps1 -Spec sentiment-moderation-service"
    Write-Host "  .\Start-Automation.ps1 -Resume"
    Write-Host ""
    exit 0
}

# Show execution plan
Write-Host "📋 Execution Plan:" -ForegroundColor Yellow
Write-Host "   1. Sentiment & Moderation Service"
Write-Host "   2. Discord-Reddit Connector"
Write-Host "   3. Zippy Trivia Show"
Write-Host "   4. Match-and-Mind Puzzle Suite"
Write-Host "   5. Community Quest RPG"
Write-Host "   6. Matchmaking & Friend Finder"
Write-Host ""

# Confirm execution
$confirmation = Read-Host "🤔 Start autonomous execution? (y/n)"
if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
    Write-Host "❌ Execution cancelled" -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "🎯 Starting autonomous executor..." -ForegroundColor Green
Write-Host "📝 Logs will be saved to: execution.log" -ForegroundColor Cyan
Write-Host "💾 State will be saved to: execution-state.json" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  You can stop execution anytime with Ctrl+C" -ForegroundColor Yellow
Write-Host "   Progress will be saved and you can resume later" -ForegroundColor Yellow
Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Build arguments
$args = @()
if ($Spec) {
    $args += "--spec"
    $args += $Spec
}
if ($Resume) {
    $args += "--resume"
}

# Run the executor
try {
    if ($args.Count -gt 0) {
        node autonomous-executor.js @args
    } else {
        node autonomous-executor.js
    }
    
    $exitCode = $LASTEXITCODE
    
    Write-Host ""
    Write-Host "================================" -ForegroundColor Cyan
    
    if ($exitCode -eq 0) {
        Write-Host "✅ Execution completed!" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Execution finished with errors (exit code: $exitCode)" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "📊 Check execution-state.json for summary" -ForegroundColor Cyan
    Write-Host "📝 Review execution.log for details" -ForegroundColor Cyan
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "❌ Error running executor: $_" -ForegroundColor Red
    Write-Host ""
    exit 1
}

# Keep window open
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
