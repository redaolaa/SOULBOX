#!/usr/bin/env node
// Fix wrong 2025-12-14 rows: replace first 3 with 2025-09-21, next 3 with 2025-09-14, next 3 with 2025-09-07
const fs = require('fs');
const path = require('path');
const inputPath = path.resolve(process.argv[2] || 'weeks-paste.csv');
const outputPath = path.resolve(process.argv[3] || 'WEEKS-2025-08-24-to-2025-09-21-fixed.csv');

const fixes = ['2025-09-21', '2025-09-21', '2025-09-21', '2025-09-14', '2025-09-14', '2025-09-14', '2025-09-07', '2025-09-07', '2025-09-07'];
let index = 0;
let content = fs.readFileSync(inputPath, 'utf8');
content = content.replace(/^2025-12-14,/gm, () => (fixes[index++] || '2025-12-14') + ',');
fs.writeFileSync(outputPath, content, 'utf8');
console.log('Fixed', index, 'rows. Output:', outputPath);
