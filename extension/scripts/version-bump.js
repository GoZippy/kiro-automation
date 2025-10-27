#!/usr/bin/env node

/**
 * Version bump script for Kiro Automation Extension
 * Handles semantic versioning and changelog updates
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
  blue: '\x1b[34m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function getCurrentVersion() {
  const packagePath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  return packageJson.version;
}

function bumpVersion(type) {
  const validTypes = ['patch', 'minor', 'major'];
  if (!validTypes.includes(type)) {
    log(`Invalid version type: ${type}. Must be one of: ${validTypes.join(', ')}`, colors.red);
    process.exit(1);
  }
  
  const currentVersion = getCurrentVersion();
  log(`\nCurrent version: ${currentVersion}`, colors.blue);
  
  try {
    // Run npm version command
    const command = `npm version ${type} --no-git-tag-version`;
    execSync(command, { stdio: 'inherit' });
    
    const newVersion = getCurrentVersion();
    log(`\n✓ Version bumped to: ${newVersion}`, colors.green);
    
    return newVersion;
  } catch (error) {
    log('\n✖ Version bump failed', colors.red);
    process.exit(1);
  }
}

function updateChangelog(version) {
  const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
  
  if (!fs.existsSync(changelogPath)) {
    log('⚠ CHANGELOG.md not found, skipping update', colors.yellow);
    return;
  }
  
  const changelog = fs.readFileSync(changelogPath, 'utf8');
  const date = new Date().toISOString().split('T')[0];
  
  // Check if version already exists in changelog
  if (changelog.includes(`## [${version}]`)) {
    log('⚠ Version already exists in CHANGELOG.md', colors.yellow);
    return;
  }
  
  // Find the position to insert new version (after # Changelog header)
  const lines = changelog.split('\n');
  const headerIndex = lines.findIndex(line => line.startsWith('# Changelog') || line.startsWith('# CHANGELOG'));
  
  if (headerIndex === -1) {
    log('⚠ Could not find changelog header, skipping update', colors.yellow);
    return;
  }
  
  // Insert new version section
  const newSection = [
    '',
    `## [${version}] - ${date}`,
    '',
    '### Added',
    '- ',
    '',
    '### Changed',
    '- ',
    '',
    '### Fixed',
    '- ',
    ''
  ];
  
  lines.splice(headerIndex + 1, 0, ...newSection);
  fs.writeFileSync(changelogPath, lines.join('\n'), 'utf8');
  
  log('✓ CHANGELOG.md updated', colors.green);
  log(`\n${colors.yellow}Please edit CHANGELOG.md to add release notes${colors.reset}`);
}

function gitCommit(version) {
  try {
    execSync('git add package.json package-lock.json CHANGELOG.md', { stdio: 'inherit' });
    execSync(`git commit -m "Bump version to ${version}"`, { stdio: 'inherit' });
    log(`\n✓ Changes committed`, colors.green);
  } catch (error) {
    log('\n⚠ Git commit failed (you may need to commit manually)', colors.yellow);
  }
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    log('\nUsage: node version-bump.js <patch|minor|major> [--no-commit]', colors.yellow);
    log('\nExamples:', colors.blue);
    log('  node version-bump.js patch       # 0.1.0 -> 0.1.1');
    log('  node version-bump.js minor       # 0.1.0 -> 0.2.0');
    log('  node version-bump.js major       # 0.1.0 -> 1.0.0');
    process.exit(1);
  }
  
  const type = args[0];
  const noCommit = args.includes('--no-commit');
  
  log('\n╔════════════════════════════════════════╗', colors.bright);
  log('║  Version Bump Tool                    ║', colors.bright);
  log('╚════════════════════════════════════════╝', colors.bright);
  
  const newVersion = bumpVersion(type);
  updateChangelog(newVersion);
  
  if (!noCommit) {
    gitCommit(newVersion);
  }
  
  log('\n╔════════════════════════════════════════╗', colors.bright);
  log('║  Version Bump Complete! 🎉            ║', colors.bright);
  log('╚════════════════════════════════════════╝', colors.bright);
  log(`\nNew version: ${newVersion}`, colors.green);
  
  if (noCommit) {
    log('\n⚠ Changes not committed (--no-commit flag used)', colors.yellow);
  }
}

main();
