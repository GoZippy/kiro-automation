#!/bin/bash

# Kiro Task Automation Launcher
# Simple script to start autonomous task execution

echo "🚀 Kiro Task Automation System"
echo "================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 14+ first."
    exit 1
fi

echo "✅ Node.js found: $(node --version)"
echo ""

# Parse arguments
if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
    echo "Usage: ./start.sh [options]"
    echo ""
    echo "Options:"
    echo "  --spec <name>    Execute only the specified spec"
    echo "  --resume         Resume from last checkpoint"
    echo "  --help, -h       Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./start.sh                                    # Run all specs"
    echo "  ./start.sh --spec sentiment-moderation-service"
    echo "  ./start.sh --resume"
    echo ""
    exit 0
fi

# Show execution plan
echo "📋 Execution Plan:"
echo "   1. Sentiment & Moderation Service"
echo "   2. Discord-Reddit Connector"
echo "   3. Zippy Trivia Show"
echo "   4. Match-and-Mind Puzzle Suite"
echo "   5. Community Quest RPG"
echo "   6. Matchmaking & Friend Finder"
echo ""

# Confirm execution
read -p "🤔 Start autonomous execution? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Execution cancelled"
    exit 0
fi

echo ""
echo "🎯 Starting autonomous executor..."
echo "📝 Logs will be saved to: execution.log"
echo "💾 State will be saved to: execution-state.json"
echo ""
echo "⚠️  You can stop execution anytime with Ctrl+C"
echo "   Progress will be saved and you can resume later"
echo ""
echo "================================"
echo ""

# Run the executor
node autonomous-executor.js "$@"

# Show completion message
echo ""
echo "================================"
echo "✅ Execution completed!"
echo ""
echo "📊 Check execution-state.json for summary"
echo "📝 Review execution.log for details"
echo ""
