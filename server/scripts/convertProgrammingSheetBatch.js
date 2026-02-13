// Convert combined "Programming Sheet SoulBox" CSV to flat format and merge with known dates
//
// Usage:
//   node scripts/convertProgrammingSheetBatch.js "/path/to/Programming Sheet SoulBox 2.csv" [output.csv]
//
// Week-to-date mapping: Week 100 = 2024-02-11 (Sunday). Week N = 2024-02-11 + (N-100)*7 days.

const fs = require('fs');
const path = require('path');

const DAY_CONFIG = {
  Sunday: { dayType: 'Kickboxing', focus: 'Upper' },
  Monday: { dayType: 'Technique', focus: 'Mixed' },
  Tuesday: { dayType: 'Boxing', focus: 'Upper' },
  Wednesday: { dayType: 'Conditioning', focus: 'Lower' },
  Thursday: { dayType: 'Kickboxing', focus: 'Mixed' },
  Saturday: { dayType: 'Technique', focus: 'Lower' }
};

const NONSTOP_SPARRING_DAYS = ['Monday', 'Wednesday', 'Saturday'];
const PLACEHOLDER = '[FILL]';
const WEEK_100_DATE = new Date('2024-02-11');

function weekNumberToDate(weekNum) {
  const d = new Date(WEEK_100_DATE);
  d.setDate(d.getDate() + (weekNum - 100) * 7);
  return d.toISOString().slice(0, 10);
}

function cleanExerciseName(name) {
  if (!name || typeof name !== 'string') return '';
  return name.trim().replace(/\s+/g, ' ').replace(/\n/g, ' ').replace(/\r/g, '');
}

function isZoneLabel(val, expected) {
  const v = (val || '').trim();
  if (v === expected) return true;
  if (expected === 'Condtion Zone A' && (v === 'Condition Zone A' || v === 'Condtion Zone A')) return true;
  if (expected === 'Condtion Zone B' && (v === 'Condition Zone B' || v === 'Condtion Zone B')) return true;
  return false;
}

function getStaticCondition(dayOfWeek, dayType) {
  if (NONSTOP_SPARRING_DAYS.includes(dayOfWeek)) {
    return `${dayType.toLowerCase()}-station3`;
  }
  return '';
}

function processDayPair(rows, startRow, day1, day2, weekStartDate, outputRows) {
  // Skip Friday - we only want Sun, Mon, Tue, Wed, Thu, Sat
  if (day2 === 'Friday') {
    processDay(rows, startRow, day1, weekStartDate, outputRows, 0);
    return;
  }
  processDay(rows, startRow, day1, weekStartDate, outputRows, 0);
  processDay(rows, startRow, day2, weekStartDate, outputRows, 7);
}

function processDay(rows, startRow, dayOfWeek, weekStartDate, outputRows, colOffset) {
  if (!DAY_CONFIG[dayOfWeek]) return;

  const config = DAY_CONFIG[dayOfWeek];
  const { dayType, focus } = config;
  const isNonstopSparring = NONSTOP_SPARRING_DAYS.includes(dayOfWeek);

  const labelCol = colOffset === 0 ? 2 : 9;
  const exerciseStartCol = colOffset === 0 ? 3 : 10;

  // Station 1 Phase 1: Condtion Zone A
  const row0 = rows[startRow];
  if (row0 && isZoneLabel(row0[labelCol], 'Condtion Zone A')) {
    ['A', 'B', 'C'].forEach((slot, idx) => {
      const ex = cleanExerciseName(row0[exerciseStartCol + idx]) || PLACEHOLDER;
      outputRows.push([weekStartDate, dayOfWeek, dayType, '1', '1', slot, ex, focus, 'FALSE', '']);
    });
  }

  // Station 1 Phase 2: Condtion Zone B
  const row1 = rows[startRow + 1];
  if (row1 && isZoneLabel(row1[labelCol], 'Condtion Zone B')) {
    ['A', 'B', 'C'].forEach((slot, idx) => {
      const ex = cleanExerciseName(row1[exerciseStartCol + idx]) || PLACEHOLDER;
      outputRows.push([weekStartDate, dayOfWeek, dayType, '1', '2', slot, ex, focus, 'FALSE', '']);
    });
  }

  // Station 2: Bag Work Zone
  const row2 = rows[startRow + 2];
  if (row2 && (row2[labelCol] || '').trim() === 'Bag Work Zone') {
    ['A', 'B', 'C'].forEach((slot, idx) => {
      const ex = cleanExerciseName(row2[exerciseStartCol + idx]) || PLACEHOLDER;
      outputRows.push([weekStartDate, dayOfWeek, dayType, '2', '', slot, ex, focus, 'FALSE', '']);
    });
  }

  // Station 3
  if (isNonstopSparring) {
    ['A', 'B', 'C'].forEach(slot => {
      outputRows.push([weekStartDate, dayOfWeek, dayType, '3', '', slot, 'Nonstop sparring', focus, 'TRUE', getStaticCondition(dayOfWeek, dayType)]);
    });
  } else {
    const row3 = rows[startRow + 3];
    const label = (row3 && row3[labelCol]) ? row3[labelCol].trim() : '';
    if (row3 && (label === 'Tecnique Zone Type' || label === 'Technique Zone Type')) {
      ['A', 'B', 'C'].forEach((slot, idx) => {
        const ex = cleanExerciseName(row3[exerciseStartCol + idx]) || PLACEHOLDER;
        outputRows.push([weekStartDate, dayOfWeek, dayType, '3', '', slot, ex, focus, 'FALSE', '']);
      });
    } else if (row3 && label === 'Sparing Zone') {
      // Friday - skip (we don't import Friday)
    }
  }
}

function parseCSV(content) {
  const rows = [];
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const row = [];
    let i = 0;
    let inQuotes = false;
    let cell = '';
    while (i < line.length) {
      const c = line[i];
      if (inQuotes) {
        if (c === '"') {
          if (line[i + 1] === '"') {
            cell += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          cell += c;
        }
        i++;
      } else {
        if (c === '"') {
          inQuotes = true;
          i++;
        } else if (c === ',') {
          row.push(cell);
          cell = '';
          i++;
        } else {
          cell += c;
          i++;
        }
      }
    }
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

async function convertBatch(inputPath, outputPath) {
  const content = fs.readFileSync(inputPath, 'utf8');
  const allRows = parseCSV(content);

  const outputRows = [];
  const weekSections = [];
  let i = 0;

  while (i < allRows.length) {
    const row = allRows[i];
    const firstCell = (row && row[0]) ? row[0].trim() : '';
    const match = firstCell.match(/^WEEK\s+(\d+)\s*:/i);
    if (match) {
      const weekNum = parseInt(match[1], 10);
      weekSections.push({ weekNum, startRow: i });
    }
    i++;
  }

  console.log(`Found ${weekSections.length} week sections`);

  for (let s = 0; s < weekSections.length; s++) {
    const { weekNum, startRow } = weekSections[s];
    const nextStart = s + 1 < weekSections.length ? weekSections[s + 1].startRow : allRows.length;
    const weekStartDate = weekNumberToDate(weekNum);
    const sectionRows = allRows.slice(startRow, nextStart);

    for (let j = 0; j < sectionRows.length; j++) {
      const row = sectionRows[j];
      const firstCol = (row && row[0]) ? row[0].trim() : '';
      const day1 = (row && row[1]) ? row[1].trim() : '';
      const day2 = (row && row[8]) ? row[8].trim() : '';

      if (firstCol === 'Training Day' && day1 && day2) {
        if (DAY_CONFIG[day1] && (DAY_CONFIG[day2] || day2 === 'Friday')) {
          const dataStartRow = j + 3;
          if (dataStartRow + 4 <= sectionRows.length) {
            processDayPair(sectionRows, dataStartRow, day1, day2, weekStartDate, outputRows);
          }
        }
      }
    }
  }

  // Write output
  const header = ['weekStartDate', 'dayOfWeek', 'dayType', 'station', 'phase', 'slot', 'exerciseName', 'focus', 'isStatic', 'staticCondition'];
  const escapeCell = (cell) => {
    const s = String(cell ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [
    header.join(','),
    ...outputRows.map(r => r.map(escapeCell).join(','))
  ];
  fs.writeFileSync(outputPath, lines.join('\n') + '\n', 'utf8');
  console.log(`Wrote ${outputRows.length} rows to ${outputPath}`);
  return outputRows.length;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (!args[0]) {
    console.error('Usage: node convertProgrammingSheetBatch.js <input-csv> [output.csv]');
    process.exit(1);
  }
  const inputPath = path.resolve(args[0]);
  const outputPath = args[1] || path.join(__dirname, '..', 'Programming-Sheet-merged-flat.csv');

  if (!fs.existsSync(inputPath)) {
    console.error('File not found:', inputPath);
    process.exit(1);
  }

  convertBatch(inputPath, outputPath)
    .then(count => {
      console.log(`\nDone. ${count} exercise rows. Import with:`);
      console.log(`  npm run import-workouts -- "Programming-Sheet-merged-flat.csv" "ola-reda@hotmail.co.uk"`);
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { convertBatch, weekNumberToDate };
