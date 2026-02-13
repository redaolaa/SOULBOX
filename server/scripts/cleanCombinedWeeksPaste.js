#!/usr/bin/env node
/**
 * Clean combined weeks paste:
 * - Strip section headers (e.g. "week 199-195..", "week 194 to 190:", "weeks 189 to 185:", etc.)
 * - Use a single header row
 * - Remove only ERRONEOUS 2025-12-14 Wednesday Conditioning Station 3 rows (those that appear
 *   right after a different week's row, i.e. in the middle of 2025-09-21, 2025-09-14, 2025-09-07, 2025-11-16)
 *   Keep the valid 2025-12-14 week block.
 *
 * Usage: node scripts/cleanCombinedWeeksPaste.js path/to/paste.txt
 */

const fs = require('fs');
const path = require('path');

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node cleanCombinedWeeksPaste.js <path-to-paste.txt>');
  process.exit(1);
}

const fullPath = path.isAbsolute(inputPath) ? inputPath : path.join(__dirname, '..', inputPath);
const dir = path.dirname(fullPath);
const base = path.basename(fullPath, path.extname(fullPath));
const outPath = path.join(dir, base + '-cleaned.csv');

const STANDARD_HEADER = 'weekStartDate,dayOfWeek,dayType,station,phase,slot,exerciseName,focus,isStatic,staticCondition';

// Section header patterns: "week 199-195..", "week 194 to 190:", "weeks 189 to 185:", "weeks 184 to 180:", "weeks 179 to 175:", "Weeks 174 to 170:"
function isSectionOrDuplicateHeader(line) {
  const t = line.trim();
  if (!t) return true;
  // Line that is ONLY the standard header (we'll keep first occurrence)
  if (t === STANDARD_HEADER) return false;
  // Label-only line: "weeks 189 to 185: " (no weekStartDate)
  if (/^weeks?\s+\d+\s+to\s+\d+\s*:?\s*$/i.test(t)) return true;
  // Line that starts with "week(s)" and contains "weekStartDate" = section label + header on same line
  if (/^weeks?\s+\d+/i.test(t) && t.includes('weekStartDate')) return true;
  // Line that is "weekStartDate,..." but with leading label (e.g. "week 199-195.. weekStartDate,...")
  if (/^weeks?\s+[\d\s\-]+\.*/i.test(t) && t.includes('weekStartDate')) return true;
  return false;
}

function isDataRow(line) {
  return /^\d{4}-\d{2}-\d{2},/.test(line.trim());
}

// Erroneous block: 2025-12-14,Wednesday,Conditioning,3,,A (then B, C) when previous line is from another week
const WRONG_WEEK_PREFIXES = ['2025-09-21,', '2025-09-14,', '2025-09-07,', '2025-11-16,'];
function isErroneous20251214WedCond3(line) {
  return line.startsWith('2025-12-14,Wednesday,Conditioning,3,,');
}

let s = fs.readFileSync(fullPath, 'utf8');
const lines = s.split(/\r?\n/);

const out = [];
let headerEmitted = false;
let i = 0;

while (i < lines.length) {
  const line = lines[i];
  const trimmed = line.trim();

  // Skip empty
  if (!trimmed) {
    i++;
    continue;
  }

  // Section or duplicate header: skip (we'll add standard header once)
  if (isSectionOrDuplicateHeader(line)) {
    if (!headerEmitted) {
      out.push(STANDARD_HEADER);
      headerEmitted = true;
    }
    i++;
    continue;
  }

  // Standard header (alone): emit once
  if (trimmed === STANDARD_HEADER) {
    if (!headerEmitted) {
      out.push(STANDARD_HEADER);
      headerEmitted = true;
    }
    i++;
    continue;
  }

  // Data row
  if (isDataRow(line)) {
    // Check for erroneous 2025-12-14 Wed Conditioning 3 block: current line is that and previous is wrong week
    if (isErroneous20251214WedCond3(line) && out.length > 0) {
      const lastOut = out[out.length - 1];
      const prevIsWrongWeek = WRONG_WEEK_PREFIXES.some((p) => lastOut.startsWith(p));
      if (prevIsWrongWeek) {
        // Skip this and the next two lines (A, B, C)
        i += 3;
        continue;
      }
    }
    if (!headerEmitted) {
      out.push(STANDARD_HEADER);
      headerEmitted = true;
    }
    out.push(line);
    i++;
    continue;
  }

  i++;
}

const outContent = out.join('\n');
fs.writeFileSync(outPath, outContent, 'utf8');
const dataCount = out.length - (headerEmitted ? 1 : 0);
console.log('Wrote:', outPath, `(${dataCount} data rows)`);
