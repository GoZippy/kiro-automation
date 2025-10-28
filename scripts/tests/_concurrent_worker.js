const path = require('path');
const registry = require(path.join(__dirname, '..', 'lib', 'registry'));

if (process.argv.length < 3) {
  console.error('Usage: node _concurrent_worker.js <absolute-path-to-add>');
  process.exit(2);
}

const target = process.argv[2];

try {
  registry.addProjectByPath(target);
  console.log('added', target);
  process.exit(0);
} catch (e) {
  console.error('worker failed:', e && e.message ? e.message : e);
  process.exit(3);
}
