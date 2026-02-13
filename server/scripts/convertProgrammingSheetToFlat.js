// Convert "Programming Sheet SoulBox" CSV format to flat CSV format for import
//
// Usage:
//   node scripts/convertProgrammingSheetToFlat.js "/path/to/WEEK X-Table 1.csv" "2026-01-04" "/path/to/output.csv"
//
// The script:
// - Reads the Programming Sheet CSV (two days per row format)
// - Extracts exercises from Condition Zone A/B, Bag Work Zone, Technique Zone
// - Maps to flat format: weekStartDate, dayOfWeek, dayType, station, phase, slot, exerciseName, focus, isStatic, staticCondition
// - Handles special rule: Monday/Wednesday/Saturday Station 3 = "Nonstop sparring" (all slots A, B, C)

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');

// Day configuration matching server/index.js DAY_CONFIG
const DAY_CONFIG = {
  Sunday: { dayType: 'Kickboxing', focus: 'Upper' },
  Monday: { dayType: 'Technique', focus: 'Mixed' },
  Tuesday: { dayType: 'Boxing', focus: 'Upper' },
  Wednesday: { dayType: 'Conditioning', focus: 'Lower' },
  Thursday: { dayType: 'Kickboxing', focus: 'Mixed' },
  Saturday: { dayType: 'Technique', focus: 'Lower' }
};

// Days that have Nonstop sparring for Station 3 (all slots)
const NONSTOP_SPARRING_DAYS = ['Monday', 'Wednesday', 'Saturday'];

const PLACEHOLDER = '[FILL]';

function cleanExerciseName(name) {
  if (!name || typeof name !== 'string') return '';
  const cleaned = name.trim().replace(/\s+/g, ' ').replace(/\n/g, ' ');
  return cleaned;
}

// Normalize zone label (some files use "Condition", template uses "Condtion")
function isZoneLabel(row, col, expected) {
  const val = row?.[col]?.trim() || '';
  if (val === expected) return true;
  if (expected === 'Condtion Zone A' && val === 'Condition Zone A') return true;
  if (expected === 'Condtion Zone B' && val === 'Condition Zone B') return true;
  return false;
}

function getStaticCondition(dayOfWeek, dayType) {
  if (NONSTOP_SPARRING_DAYS.includes(dayOfWeek)) {
    const dayTypeLower = dayType.toLowerCase();
    return `${dayTypeLower}-station3`;
  }
  return '';
}

async function convertCSV(inputPath, weekStartDate, outputPath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    const outputRows = [];

    fs.createReadStream(inputPath)
      .pipe(parse({
        relax_column_count: true,
        skip_empty_lines: false
      }))
      .on('data', (row) => {
        rows.push(row);
      })
      .on('end', () => {
        try {
          // Find day header rows and process
          // Row 3 (0-indexed) = "Training Day,Sunday,...,Training Day,Monday,..."
          // Row 6 (0-indexed) = Data starts (Condtion Zone A)
          
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length < 2) continue;
            
            // Look for "Training Day" pattern
            const firstCol = row[0]?.trim();
            if (firstCol === 'Training Day') {
              const day1 = row[1]?.trim();
              const day2 = row[8]?.trim(); // Monday is in column 8, not 7
              
              // Check if this is a valid day pair
              if (day1 && DAY_CONFIG[day1] && day2 && DAY_CONFIG[day2]) {
                // Data rows start 3 rows after header (skip empty row and "Approved?" row)
                const dataStartRow = i + 3;
                if (dataStartRow < rows.length) {
                  processDayPair(rows, dataStartRow, day1, day2, weekStartDate, outputRows);
                }
              }
            }
          }

          // Write output CSV (comma-separated)
          const header = ['weekStartDate', 'dayOfWeek', 'dayType', 'station', 'phase', 'slot', 'exerciseName', 'focus', 'isStatic', 'staticCondition'];
          const lines = [
            header.join(','),
            ...outputRows.map(row => row.map(cell => {
              // Escape commas and quotes in cells
              if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
                return `"${cell.replace(/"/g, '""')}"`;
              }
              return cell;
            }).join(','))
          ];
          const csvContent = lines.join('\n') + '\n';

          fs.writeFileSync(outputPath, csvContent, 'utf8');
          console.log(`✅ Converted ${outputRows.length} exercises to: ${outputPath}`);
          resolve(outputRows.length);
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

function processDayPair(rows, startRow, day1, day2, weekStartDate, outputRows) {
  // Process first day (left side: label in col 2, exercises in cols 3,4,5)
  processDay(rows, startRow, day1, weekStartDate, outputRows, 0);
  
  // Process second day (right side: label in col 9, exercises in cols 10,11,12)
  processDay(rows, startRow, day2, weekStartDate, outputRows, 7);
}

function processDay(rows, startRow, dayOfWeek, weekStartDate, outputRows, colOffset) {
  const config = DAY_CONFIG[dayOfWeek];
  if (!config) {
    console.warn(`⚠️  Unknown day: ${dayOfWeek}, skipping`);
    return;
  }

  const { dayType, focus } = config;
  const isNonstopSparring = NONSTOP_SPARRING_DAYS.includes(dayOfWeek);

  // Station 1 Phase 1: Condition Zone A
  // Left side: label in col 2, exercises in cols 3,4,5
  // Right side: label in col 9, exercises in cols 10,11,12
  const condZoneARow = rows[startRow];
  if (!condZoneARow) {
    return;
  }
  const labelCol = colOffset === 0 ? 2 : 9;
  if (isZoneLabel(condZoneARow, labelCol, 'Condtion Zone A')) {
    const exerciseStartCol = colOffset === 0 ? 3 : 10;
    const exercises = [
      cleanExerciseName(condZoneARow[exerciseStartCol]) || PLACEHOLDER,
      cleanExerciseName(condZoneARow[exerciseStartCol + 1]) || PLACEHOLDER,
      cleanExerciseName(condZoneARow[exerciseStartCol + 2]) || PLACEHOLDER
    ];
    exercises.forEach((ex, idx) => {
      outputRows.push([
        weekStartDate,
        dayOfWeek,
        dayType,
        '1',
        '1',
        ['A', 'B', 'C'][idx],
        ex,
        focus,
        'FALSE',
        ''
      ]);
    });
  }

  // Station 1 Phase 2: Condition Zone B
  const condZoneBRow = rows[startRow + 1];
  const condZoneBLabelCol = colOffset === 0 ? 2 : 9;
  if (condZoneBRow && isZoneLabel(condZoneBRow, condZoneBLabelCol, 'Condtion Zone B')) {
    const exerciseStartCol = colOffset === 0 ? 3 : 10;
    const exercises = [
      cleanExerciseName(condZoneBRow[exerciseStartCol]) || PLACEHOLDER,
      cleanExerciseName(condZoneBRow[exerciseStartCol + 1]) || PLACEHOLDER,
      cleanExerciseName(condZoneBRow[exerciseStartCol + 2]) || PLACEHOLDER
    ];
    exercises.forEach((ex, idx) => {
      outputRows.push([
        weekStartDate,
        dayOfWeek,
        dayType,
        '1',
        '2',
        ['A', 'B', 'C'][idx],
        ex,
        focus,
        'FALSE',
        ''
      ]);
    });
  }

  // Station 2: Bag Work Zone
  const bagWorkRow = rows[startRow + 2];
  const bagWorkLabelCol = colOffset === 0 ? 2 : 9;
  if (bagWorkRow && bagWorkRow[bagWorkLabelCol]?.trim() === 'Bag Work Zone') {
    const exerciseStartCol = colOffset === 0 ? 3 : 10;
    const exercises = [
      cleanExerciseName(bagWorkRow[exerciseStartCol]) || PLACEHOLDER,
      cleanExerciseName(bagWorkRow[exerciseStartCol + 1]) || PLACEHOLDER,
      cleanExerciseName(bagWorkRow[exerciseStartCol + 2]) || PLACEHOLDER
    ];
    exercises.forEach((ex, idx) => {
      outputRows.push([
        weekStartDate,
        dayOfWeek,
        dayType,
        '2',
        '',
        ['A', 'B', 'C'][idx],
        ex,
        focus,
        'FALSE',
        ''
      ]);
    });
  }

  // Station 3: Technique Zone (row startRow+3)
  // Special rule: Mon/Wed/Sat = Nonstop sparring for all slots
  if (isNonstopSparring) {
    ['A', 'B', 'C'].forEach(slot => {
      outputRows.push([
        weekStartDate,
        dayOfWeek,
        dayType,
        '3',
        '',
        slot,
        'Nonstop sparring',
        focus,
        'TRUE',
        getStaticCondition(dayOfWeek, dayType)
      ]);
    });
  } else {
    // Regular Technique Zone Type
    const techZoneRow = rows[startRow + 3];
    const techZoneLabelCol = colOffset === 0 ? 2 : 9;
    if (techZoneRow && techZoneRow[techZoneLabelCol]?.trim() === 'Tecnique Zone Type') {
      const exerciseStartCol = colOffset === 0 ? 3 : 10;
      const exercises = [
        cleanExerciseName(techZoneRow[exerciseStartCol]) || PLACEHOLDER,
        cleanExerciseName(techZoneRow[exerciseStartCol + 1]) || PLACEHOLDER,
        cleanExerciseName(techZoneRow[exerciseStartCol + 2]) || PLACEHOLDER
      ];
      exercises.forEach((ex, idx) => {
        outputRows.push([
          weekStartDate,
          dayOfWeek,
          dayType,
          '3',
          '',
          ['A', 'B', 'C'][idx],
          ex,
          focus,
          'FALSE',
          ''
        ]);
      });
    }
  }
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node convertProgrammingSheetToFlat.js <input-csv> <weekStartDate> [output-csv]');
    console.error('Example: node convertProgrammingSheetToFlat.js "WEEK 199-Table 1.csv" "2026-01-04"');
    process.exit(1);
  }

  const inputPath = path.resolve(args[0]);
  const weekStartDate = args[1];
  // Default output to server directory with weekStartDate in filename
  const defaultOutput = path.join(__dirname, '..', `WEEK-${weekStartDate}-flat.csv`);
  const outputPath = args[2] || defaultOutput;

  if (!fs.existsSync(inputPath)) {
    console.error(`❌ File not found: ${inputPath}`);
    process.exit(1);
  }

  convertCSV(inputPath, weekStartDate, outputPath)
    .then((count) => {
      console.log(`\n✨ Conversion complete! ${count} exercises extracted.`);
      console.log(`📄 Output: ${outputPath}`);
      console.log(`\nNext step: Import with:`);
      console.log(`  npm run import-workouts -- "${outputPath}" "ola-reda@hotmail.co.uk"`);
    })
    .catch((error) => {
      console.error('❌ Error:', error.message);
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = { convertCSV };
