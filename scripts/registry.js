#!/usr/bin/env node
"use strict";
const fs = require('fs');
const path = require('path');

const registryLib = require(path.join(__dirname, 'lib', 'registry'));

function listProjects() {
  const projects = registryLib.listProjects();
  if (!projects || projects.length === 0) {
    console.log('No projects registered');
    return;
  }
  projects.forEach((p, i) => {
    console.log(`${i + 1}. ${p.name} - ${p.path} (status: ${p.status || 'unknown'})`);
  });
}

function removeProject(pathArg) {
  const ok = registryLib.removeProject(pathArg);
  if (!ok) console.log('No matching project found to remove');
  else console.log('Removed project(s) matching:', pathArg);
}

function addProject(projectPath) {
  const entry = registryLib.addProjectByPath(projectPath);
  console.log('Registered project:', entry.path);
}

function usage() {
  console.log('Usage: node registry.js <command> [args]');
  console.log('Commands: list | add <path> | remove <path|name>');
}

const args = process.argv.slice(2);
if (args.length === 0) { usage(); process.exit(1); }
const cmd = args[0];
if (cmd === 'list') listProjects();
else if (cmd === 'add' && args[1]) addProject(args[1]);
else if (cmd === 'remove' && args[1]) removeProject(args[1]);
else usage();
