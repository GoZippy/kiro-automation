#!/usr/bin/env node

/**
 * Build script for Kiro Automation Extension
 * Handles compilation, validation, and packaging
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function exec(command, options = {}) {
  try {
    log(`\n${colors.blue}▶ ${command}${colors.reset}`);
    execSync(command, { stdio: 'inherit', ...options });
    return true;
  } catch (error) {
    log(`\n${colors.red}✖ Command failed: ${command}${colors.reset}`, colors.red);
    return false;
  }
}

function checkFile(filePath) {
  const fullPath = path.join(__dirname, '..', filePath);
  if (!fs.existsSync(fullPath)) {
    log(`✖ Missing required file: ${filePath}`, colors.red);
    return false;
  }
  log(`✓ Found: ${filePath}`, colors.green);
  return true;
}

function validatePackage() {
  log('\n=== Validating Package ===', colors.bright);
  
  const requiredFiles = [
    'package.json',
    'README.md',
    'CHANGELOG.md',
    'LICENSE'
  ];
  
  let valid = true;
  for (const file of requiredFiles) {
    if (!checkFile(file)) {
      valid = false;
    }
  }
  
  if (!valid) {
    log('\n✖ Package validation failed', colors.red);
    process.exit(1);
  }
  
  log('\n✓ Package validation passed', colors.green);
}

function clean() {
  log('\n=== Cleaning ===', colors.bright);
  exec('npm run clean');
}

function lint() {
  log('\n=== Linting ===', colors.bright);
  if (!exec('npm run lint')) {
    log('\n✖ Linting failed', colors.red);
    process.exit(1);
  }
}

function compile() {
  log('\n=== Compiling TypeScript ===', colors.bright);
  if (!exec('npm run compile')) {
    log('\n✖ Compilation failed', colors.red);
    process.exit(1);
  }
}

function test() {
  log('\n=== Running Tests ===', colors.bright);
  if (!exec('npm test')) {
    log('\n⚠ Tests failed (continuing anyway)', colors.yellow);
  }
}

function packageExtension() {
  log('\n=== Packaging Extension ===', colors.bright);
  
  // Create dist directory if it doesn't exist
  const distDir = path.join(__dirname, '..', 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  
  if (!exec('npm run package')) {
    log('\n✖ Packaging failed', colors.red);
    process.exit(1);
  }
  
  log('\n✓ Extension packaged successfully', colors.green);
}

function main() {
  const args = process.argv.slice(2);
  const skipTests = args.includes('--skip-tests');
  const skipLint = args.includes('--skip-lint');
  
  log('\n╔════════════════════════════════════════╗', colors.bright);
  log('║  Kiro Automation Extension Builder    ║', colors.bright);
  log('╚════════════════════════════════════════╝', colors.bright);
  
  validatePackage();
  clean();
  
  if (!skipLint) {
    lint();
  }
  
  compile();
  
  if (!skipTests) {
    test();
  }
  
  packageExtension();
  
  log('\n╔════════════════════════════════════════╗', colors.bright);
  log('║  Build Complete! 🎉                   ║', colors.bright);
  log('╚════════════════════════════════════════╝', colors.bright);
  log('\nPackage location: dist/', colors.green);
}

main();
