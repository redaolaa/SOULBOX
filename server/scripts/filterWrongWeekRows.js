#!/usr/bin/env node
/**
 * Filter out erroneous 2025-12-14 rows from a flat workout CSV.
 * Reads from path (argv[2]), writes to same dir with -cleaned.csv suffix.
 *
 * Usage: node scripts/filterWrongWeekRows.js path/to/file.txt
 */

const fs = require('fs');
const path = require('path');

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node filterWrongWeekRows.js <path-to-csv-or-txt>');
  process.exit(1);
}

const fullPath = path.isAbsolute(inputPath) ? inputPath : path.join(__dirname, '..', inputPath);
const dir = path.dirname(fullPath);
const base = path.basename(fullPath, path.extname(fullPath));
const outPath = path.join(dir, base + '-cleaned.csv');

let s = fs.readFileSync(fullPath, 'utf8');
const lines = s.split(/\r?\n/);

// Normalize header: if first line has "weekStartDate" in it, use standard header
const headerLine = lines[0].includes('weekStartDate')
  ? 'weekStartDate,dayOfWeek,dayType,station,phase,slot,exerciseName,focus,isStatic,staticCondition'
  : lines[0];

const dataLines = lines.slice(1).filter((l) => !l.startsWith('2025-12-14,'));
const out = [headerLine, ...dataLines].join('\n');

fs.writeFileSync(outPath, out, 'utf8');
console.log('Wrote:', outPath, `(${dataLines.length} data rows)`);
