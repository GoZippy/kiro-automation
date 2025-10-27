#!/usr/bin/env node

/**
 * Pre-publish validation script
 * Ensures all requirements are met before publishing to marketplace
 */

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

class Validator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }
  
  error(message) {
    this.errors.push(message);
    log(`✖ ${message}`, colors.red);
  }
  
  warning(message) {
    this.warnings.push(message);
    log(`⚠ ${message}`, colors.yellow);
  }
  
  success(message) {
    log(`✓ ${message}`, colors.green);
  }
  
  hasErrors() {
    return this.errors.length > 0;
  }
  
  printSummary() {
    log('\n' + '='.repeat(50), colors.bright);
    log('Validation Summary', colors.bright);
    log('='.repeat(50), colors.bright);
    
    if (this.errors.length > 0) {
      log(`\n${this.errors.length} error(s) found:`, colors.red);
      this.errors.forEach((err, i) => log(`  ${i + 1}. ${err}`, colors.red));
    }
    
    if (this.warnings.length > 0) {
      log(`\n${this.warnings.length} warning(s) found:`, colors.yellow);
      this.warnings.forEach((warn, i) => log(`  ${i + 1}. ${warn}`, colors.yellow));
    }
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      log('\n✓ All validations passed!', colors.green);
    }
  }
}

function validateFile(validator, filePath, required = true) {
  const fullPath = path.join(__dirname, '..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    if (required) {
      validator.error(`Missing required file: ${filePath}`);
    } else {
      validator.warning(`Missing optional file: ${filePath}`);
    }
    return false;
  }
  
  const stats = fs.statSync(fullPath);
  if (stats.size === 0) {
    validator.warning(`File is empty: ${filePath}`);
    return false;
  }
  
  validator.success(`Found ${filePath} (${stats.size} bytes)`);
  return true;
}

function validatePackageJson(validator) {
  log('\n=== Validating package.json ===', colors.blue);
  
  const packagePath = path.join(__dirname, '..', 'package.json');
  if (!fs.existsSync(packagePath)) {
    validator.error('package.json not found');
    return;
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  // Required fields
  const requiredFields = [
    'name',
    'displayName',
    'description',
    'version',
    'publisher',
    'engines',
    'categories',
    'main'
  ];
  
  requiredFields.forEach(field => {
    if (!packageJson[field]) {
      validator.error(`Missing required field in package.json: ${field}`);
    } else {
      validator.success(`package.json has ${field}`);
    }
  });
  
  // Recommended fields
  const recommendedFields = ['repository', 'license', 'keywords', 'icon'];
  recommendedFields.forEach(field => {
    if (!packageJson[field]) {
      validator.warning(`Missing recommended field in package.json: ${field}`);
    } else {
      validator.success(`package.json has ${field}`);
    }
  });
  
  // Validate version format
  const versionRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;
  if (!versionRegex.test(packageJson.version)) {
    validator.error(`Invalid version format: ${packageJson.version}`);
  } else {
    validator.success(`Valid version: ${packageJson.version}`);
  }
  
  // Check for placeholder values
  if (packageJson.publisher === 'your-publisher-name') {
    validator.error('Publisher name is still a placeholder');
  }
  
  // Validate description length
  if (packageJson.description && packageJson.description.length < 10) {
    validator.warning('Description is too short (should be at least 10 characters)');
  }
  
  if (packageJson.description && packageJson.description.length > 200) {
    validator.warning('Description is too long (should be under 200 characters)');
  }
}

function validateReadme(validator) {
  log('\n=== Validating README.md ===', colors.blue);
  
  if (!validateFile(validator, 'README.md', true)) {
    return;
  }
  
  const readmePath = path.join(__dirname, '..', 'README.md');
  const readme = fs.readFileSync(readmePath, 'utf8');
  
  // Check for essential sections
  const requiredSections = [
    'Features',
    'Installation',
    'Usage'
  ];
  
  requiredSections.forEach(section => {
    if (!readme.includes(section)) {
      validator.warning(`README.md missing recommended section: ${section}`);
    } else {
      validator.success(`README.md has ${section} section`);
    }
  });
  
  // Check minimum length
  if (readme.length < 500) {
    validator.warning('README.md is quite short (less than 500 characters)');
  }
}

function validateChangelog(validator) {
  log('\n=== Validating CHANGELOG.md ===', colors.blue);
  
  if (!validateFile(validator, 'CHANGELOG.md', true)) {
    return;
  }
  
  const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
  const changelog = fs.readFileSync(changelogPath, 'utf8');
  
  // Get current version from package.json
  const packagePath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const currentVersion = packageJson.version;
  
  if (!changelog.includes(currentVersion)) {
    validator.error(`CHANGELOG.md does not include current version ${currentVersion}`);
  } else {
    validator.success(`CHANGELOG.md includes version ${currentVersion}`);
  }
}

function validateIcon(validator) {
  log('\n=== Validating Icon ===', colors.blue);
  
  const packagePath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  if (!packageJson.icon) {
    validator.warning('No icon specified in package.json');
    return;
  }
  
  validateFile(validator, packageJson.icon, false);
}

function validateLicense(validator) {
  log('\n=== Validating License ===', colors.blue);
  validateFile(validator, 'LICENSE', true);
}

function validateCompiledOutput(validator) {
  log('\n=== Validating Compiled Output ===', colors.blue);
  
  const outDir = path.join(__dirname, '..', 'out');
  if (!fs.existsSync(outDir)) {
    validator.error('Output directory (out/) not found. Run "npm run compile" first.');
    return;
  }
  
  const mainFile = path.join(outDir, 'src', 'extension.js');
  if (!fs.existsSync(mainFile)) {
    validator.error('Main extension file not found in out/src/extension.js');
  } else {
    validator.success('Compiled extension file found');
  }
}

function main() {
  log('\n╔════════════════════════════════════════╗', colors.bright);
  log('║  Pre-Publish Validation               ║', colors.bright);
  log('╚════════════════════════════════════════╝', colors.bright);
  
  const validator = new Validator();
  
  validatePackageJson(validator);
  validateReadme(validator);
  validateChangelog(validator);
  validateIcon(validator);
  validateLicense(validator);
  validateCompiledOutput(validator);
  
  validator.printSummary();
  
  if (validator.hasErrors()) {
    log('\n✖ Validation failed. Please fix the errors before publishing.', colors.red);
    process.exit(1);
  }
  
  if (validator.warnings.length > 0) {
    log('\n⚠ Validation passed with warnings. Consider addressing them before publishing.', colors.yellow);
  } else {
    log('\n✓ Ready to publish!', colors.green);
  }
}

main();
