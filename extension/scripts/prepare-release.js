#!/usr/bin/env node

/**
 * Release preparation script
 * Helps prepare a new release by checking all requirements
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function exec(command, silent = false) {
  try {
    return execSync(command, { 
      encoding: 'utf8',
      stdio: silent ? 'pipe' : 'inherit'
    });
  } catch (error) {
    return null;
  }
}

class ReleaseChecker {
  constructor() {
    this.issues = [];
    this.warnings = [];
    this.info = [];
  }
  
  issue(message) {
    this.issues.push(message);
    log(`✖ ${message}`, colors.red);
  }
  
  warning(message) {
    this.warnings.push(message);
    log(`⚠ ${message}`, colors.yellow);
  }
  
  success(message) {
    log(`✓ ${message}`, colors.green);
  }
  
  info(message) {
    this.info.push(message);
    log(`ℹ ${message}`, colors.cyan);
  }
  
  hasIssues() {
    return this.issues.length > 0;
  }
}

function getPackageInfo() {
  const packagePath = path.join(__dirname, '..', 'package.json');
  return JSON.parse(fs.readFileSync(packagePath, 'utf8'));
}

function checkGitStatus(checker) {
  log('\n=== Git Status ===', colors.blue);
  
  const status = exec('git status --porcelain', true);
  if (status && status.trim()) {
    checker.warning('Working directory has uncommitted changes');
    log(status, colors.yellow);
  } else {
    checker.success('Working directory is clean');
  }
  
  const branch = exec('git branch --show-current', true);
  if (branch) {
    const currentBranch = branch.trim();
    checker.info(`Current branch: ${currentBranch}`);
    
    if (currentBranch !== 'main' && currentBranch !== 'master') {
      checker.warning(`Not on main/master branch (currently on ${currentBranch})`);
    }
  }
}

function checkVersion(checker) {
  log('\n=== Version Check ===', colors.blue);
  
  const pkg = getPackageInfo();
  const version = pkg.version;
  
  checker.info(`Current version: ${version}`);
  
  // Check if version is valid semver
  const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/;
  if (!semverRegex.test(version)) {
    checker.issue(`Invalid version format: ${version}`);
  } else {
    checker.success('Version format is valid');
  }
  
  // Check if tag already exists
  const tagExists = exec(`git tag -l v${version}`, true);
  if (tagExists && tagExists.trim()) {
    checker.warning(`Tag v${version} already exists`);
  } else {
    checker.success(`Tag v${version} does not exist yet`);
  }
}

function checkChangelog(checker) {
  log('\n=== Changelog Check ===', colors.blue);
  
  const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
  if (!fs.existsSync(changelogPath)) {
    checker.issue('CHANGELOG.md not found');
    return;
  }
  
  const changelog = fs.readFileSync(changelogPath, 'utf8');
  const pkg = getPackageInfo();
  const version = pkg.version;
  
  if (!changelog.includes(`## [${version}]`)) {
    checker.issue(`CHANGELOG.md does not include version ${version}`);
  } else {
    checker.success(`CHANGELOG.md includes version ${version}`);
  }
  
  // Check for unreleased section
  if (changelog.includes('## [Unreleased]')) {
    checker.info('CHANGELOG.md has Unreleased section');
  }
  
  // Check for date
  const today = new Date().toISOString().split('T')[0];
  if (changelog.includes(`## [${version}] - ${today}`)) {
    checker.success(`CHANGELOG.md has today's date for version ${version}`);
  } else {
    checker.warning(`CHANGELOG.md may not have today's date for version ${version}`);
  }
}

function checkTests(checker) {
  log('\n=== Test Status ===', colors.blue);
  
  checker.info('Running tests...');
  const testResult = exec('npm test', true);
  
  if (testResult === null) {
    checker.warning('Tests failed or not run');
  } else {
    checker.success('All tests passed');
  }
}

function checkBuild(checker) {
  log('\n=== Build Check ===', colors.blue);
  
  checker.info('Compiling TypeScript...');
  const compileResult = exec('npm run compile', true);
  
  if (compileResult === null) {
    checker.issue('TypeScript compilation failed');
  } else {
    checker.success('TypeScript compilation successful');
  }
  
  // Check if out directory exists
  const outDir = path.join(__dirname, '..', 'out');
  if (!fs.existsSync(outDir)) {
    checker.issue('Output directory (out/) not found');
  } else {
    checker.success('Output directory exists');
  }
}

function checkDependencies(checker) {
  log('\n=== Dependency Check ===', colors.blue);
  
  checker.info('Checking for outdated dependencies...');
  const outdated = exec('npm outdated --json', true);
  
  if (outdated && outdated.trim() && outdated !== '{}') {
    const outdatedPkgs = JSON.parse(outdated);
    const count = Object.keys(outdatedPkgs).length;
    checker.warning(`${count} outdated dependencies found`);
    
    Object.entries(outdatedPkgs).forEach(([name, info]) => {
      log(`  ${name}: ${info.current} → ${info.latest}`, colors.yellow);
    });
  } else {
    checker.success('All dependencies are up to date');
  }
  
  checker.info('Running security audit...');
  const audit = exec('npm audit --json', true);
  
  if (audit) {
    try {
      const auditData = JSON.parse(audit);
      const vulnCount = auditData.metadata?.vulnerabilities?.total || 0;
      
      if (vulnCount > 0) {
        checker.warning(`${vulnCount} security vulnerabilities found`);
      } else {
        checker.success('No security vulnerabilities found');
      }
    } catch (e) {
      checker.warning('Could not parse audit results');
    }
  }
}

function checkDocumentation(checker) {
  log('\n=== Documentation Check ===', colors.blue);
  
  const requiredDocs = [
    'README.md',
    'CHANGELOG.md',
    'LICENSE',
    'VERSIONING.md'
  ];
  
  requiredDocs.forEach(doc => {
    const docPath = path.join(__dirname, '..', doc);
    if (!fs.existsSync(docPath)) {
      checker.issue(`Missing ${doc}`);
    } else {
      checker.success(`Found ${doc}`);
    }
  });
}

function generateReleaseNotes(checker) {
  log('\n=== Release Notes ===', colors.blue);
  
  const pkg = getPackageInfo();
  const version = pkg.version;
  
  const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
  if (!fs.existsSync(changelogPath)) {
    checker.warning('Cannot generate release notes without CHANGELOG.md');
    return;
  }
  
  const changelog = fs.readFileSync(changelogPath, 'utf8');
  const versionRegex = new RegExp(`## \\[${version}\\][\\s\\S]*?(?=## \\[|$)`);
  const match = changelog.match(versionRegex);
  
  if (match) {
    log('\nRelease notes for v' + version + ':', colors.cyan);
    log('─'.repeat(50), colors.cyan);
    log(match[0].trim(), colors.reset);
    log('─'.repeat(50), colors.cyan);
  } else {
    checker.warning('Could not extract release notes from CHANGELOG.md');
  }
}

function printSummary(checker) {
  log('\n' + '═'.repeat(60), colors.bright);
  log('Release Preparation Summary', colors.bright);
  log('═'.repeat(60), colors.bright);
  
  if (checker.issues.length > 0) {
    log(`\n❌ ${checker.issues.length} issue(s) found:`, colors.red);
    checker.issues.forEach((issue, i) => {
      log(`  ${i + 1}. ${issue}`, colors.red);
    });
  }
  
  if (checker.warnings.length > 0) {
    log(`\n⚠️  ${checker.warnings.length} warning(s):`, colors.yellow);
    checker.warnings.forEach((warning, i) => {
      log(`  ${i + 1}. ${warning}`, colors.yellow);
    });
  }
  
  if (checker.issues.length === 0 && checker.warnings.length === 0) {
    log('\n✅ All checks passed! Ready to release.', colors.green);
  } else if (checker.issues.length === 0) {
    log('\n✅ No blocking issues. Consider addressing warnings.', colors.green);
  } else {
    log('\n❌ Please fix the issues before releasing.', colors.red);
  }
}

function printNextSteps(checker) {
  const pkg = getPackageInfo();
  const version = pkg.version;
  
  log('\n' + '═'.repeat(60), colors.bright);
  log('Next Steps', colors.bright);
  log('═'.repeat(60), colors.bright);
  
  if (checker.hasIssues()) {
    log('\n1. Fix the issues listed above', colors.yellow);
    log('2. Run this script again', colors.yellow);
  } else {
    log('\n1. Review the release notes above', colors.cyan);
    log('2. Commit any final changes:', colors.cyan);
    log('   git add .', colors.reset);
    log('   git commit -m "chore: prepare release v' + version + '"', colors.reset);
    log('\n3. Create and push the tag:', colors.cyan);
    log('   git tag v' + version, colors.reset);
    log('   git push origin main', colors.reset);
    log('   git push origin v' + version, colors.reset);
    log('\n4. GitHub Actions will automatically:', colors.cyan);
    log('   - Build the extension', colors.reset);
    log('   - Run tests', colors.reset);
    log('   - Publish to VS Code Marketplace', colors.reset);
    log('   - Create GitHub release', colors.reset);
    log('\n5. Monitor the release workflow:', colors.cyan);
    log('   https://github.com/kiro/kiro-automation-extension/actions', colors.reset);
  }
}

function main() {
  log('\n╔════════════════════════════════════════════════════════════╗', colors.bright);
  log('║           Release Preparation Checker                      ║', colors.bright);
  log('╚════════════════════════════════════════════════════════════╝', colors.bright);
  
  const checker = new ReleaseChecker();
  
  checkGitStatus(checker);
  checkVersion(checker);
  checkChangelog(checker);
  checkDocumentation(checker);
  checkBuild(checker);
  checkTests(checker);
  checkDependencies(checker);
  generateReleaseNotes(checker);
  
  printSummary(checker);
  printNextSteps(checker);
  
  log('\n');
  
  process.exit(checker.hasIssues() ? 1 : 0);
}

main();
