#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const template = read('src/index.template.html');
if (template.split('{{STYLES}}').length !== 2 || template.split('{{APP}}').length !== 2) throw new Error('Build template must contain each placeholder exactly once');
const styles = read('src/styles.css');
const app = ['src/data.js', 'src/core.js', 'src/ui.js'].map(read).join('');
const html = template.replace('{{STYLES}}', () => styles).replace('{{APP}}', () => app);
const output = path.join(root, 'dnd_builder.html');

if (process.argv.includes('--check')) {
  if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== html) {
    console.error('dnd_builder.html is out of date; run node scripts/build.cjs');
    process.exitCode = 1;
  }
} else {
  fs.writeFileSync(output, html);
  console.log(`Built ${path.relative(root, output)}`);
}
