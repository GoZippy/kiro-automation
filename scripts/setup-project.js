#!/usr/bin/env node
"use strict";
const fs = require('fs');
const path = require('path');
// JSON Schema validation (optional runtime validation)
let Ajv;
try {
  Ajv = require('ajv');
} catch (e) {
  Ajv = null;
}

function usage() {
  console.log('Usage: node setup-project.js <target-project-path>');
  process.exit(1);
}

if (process.argv.length < 3) {
  usage();
}

const targetArg = process.argv[2];
const targetPath = path.resolve(process.cwd(), targetArg);
const repoRoot = path.resolve(__dirname, '..');
const executorPath = path.relative(targetPath, path.join(repoRoot, 'executor', 'autonomous-executor.js'));

if (!fs.existsSync(targetPath)) {
  console.error(`Target path does not exist: ${targetPath}`);
  process.exit(2);
}

// Ensure .kiro directory
const kiroDir = path.join(targetPath, '.kiro');
if (!fs.existsSync(kiroDir)) {
  fs.mkdirSync(kiroDir, { recursive: true });
  console.log(`Created directory: ${kiroDir}`);
}

// Create config.json
const config = {
  version: '1.0.0',
  projectName: path.basename(targetPath),
  executorPath: executorPath.replace(/\\/g, '/'),
  workspace: '.',
  specsPath: '.kiro/specs',
  automationPath: '.kiro/automation',
  runCmd: 'run.cmd'
};

// If Ajv is available, validate the generated config against the extension schema
const schemaPath = path.join(repoRoot, 'extension', 'schemas', 'project-config.schema.json');
if (Ajv && fs.existsSync(schemaPath)) {
  try {
    const schema = JSON.parse(fs.readFileSync(schemaPath, { encoding: 'utf8' }));
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);
    const valid = validate(config);
    if (!valid) {
      console.error('Generated project config is invalid according to schema:');
      for (const err of validate.errors || []) {
        console.error(` - ${err.instancePath} ${err.message}`);
      }
      process.exit(4);
    }
  } catch (err) {
    console.warn('Failed to validate config against schema:', err.message || err);
  }
} else if (!Ajv) {
  console.warn('Ajv not installed; skipping JSON-Schema validation. To enable, run `npm install ajv` in the repository root.');
}

const configPath = path.join(kiroDir, 'config.json');
fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { encoding: 'utf8' });
console.log(`Wrote project config: ${configPath}`);

// Create run.cmd at project root
const runCmdPath = path.join(targetPath, 'run.cmd');
const runCmdContent = `@echo off\r\nREM Convenience script to invoke KiroAutomation executor for this project\r\nSET SCRIPT_DIR=%~dp0\r\nREM Resolve path to config.json inside .kiro\r\nSET CONFIG_PATH=%SCRIPT_DIR%.kiro\\config.json\r\nIF NOT EXIST "%CONFIG_PATH%" (\r\n  echo Missing configuration file: %CONFIG_PATH%\r\n  exit /b 2\r\n)\r\n\r\nREM Resolve executor path from config (relative to project root)\r\nfor /f "delims=" %%i in ('node -e "const c=require('./.kiro/config.json'); console.log(c.executorPath)"') do set EXEC_PATH=%%i\r\n\r\nIF NOT DEFINED EXEC_PATH (\r\n  echo Failed to determine executor path from config.json\r\n  exit /b 3\r\n)\r\n\r\nREM Call the executor with --workspace pointing to the project root and pass through any args\r\nnode "%EXEC_PATH%" --workspace "%SCRIPT_DIR%" %*\r\n`;

fs.writeFileSync(runCmdPath, runCmdContent, { encoding: 'utf8' });
console.log(`Wrote run script: ${runCmdPath}`);

// Register project in shared registry
const registryLib = require(path.join(__dirname, 'lib', 'registry'));
const absTarget = targetPath;
registryLib.addProjectEntry({
  name: config.projectName,
  path: absTarget,
  configPath: configPath,
  lastExecution: null,
  status: 'registered'
});
console.log(`Registered project in: ${registryLib.registryPath}`);

// Append a note to README.md in target project (create if missing)
const readmePath = path.join(targetPath, 'README.md');
const readmeNote = '\n## Kiro Automation\nThis project has been configured to use KiroAutomation. Use `run.cmd` at the project root to invoke the executor with this workspace.\n';
if (fs.existsSync(readmePath)) {
  fs.appendFileSync(readmePath, readmeNote, { encoding: 'utf8' });
} else {
  fs.writeFileSync(readmePath, `# ${config.projectName}\n` + readmeNote, { encoding: 'utf8' });
}
console.log('Setup complete.');
