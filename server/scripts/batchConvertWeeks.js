// Batch convert multiple Programming Sheet CSVs to flat format
//
// Usage:
//   node scripts/batchConvertWeeks.js "/path/to/folder" "2026-01-04" "2026-01-11" "2026-01-18" ...
//
// Or provide a CSV mapping file:
//   node scripts/batchConvertWeeks.js --mapping mapping.csv
//
// Mapping CSV format:
//   filename,weekStartDate
//   WEEK 199-Table 1.csv,2026-01-04
//   WEEK 200-Table 1.csv,2026-01-11

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const { convertCSV } = require('./convertProgrammingSheetToFlat');

async function batchConvert(folderPath, weekDates) {
  const files = fs.readdirSync(folderPath)
    .filter(f => f.match(/WEEK\s+\d+.*\.csv$/i))
    .sort();

  console.log(`Found ${files.length} week files in ${folderPath}\n`);

  for (let i = 0; i < files.length && i < weekDates.length; i++) {
    const file = files[i];
    const weekDate = weekDates[i];
    const inputPath = path.join(folderPath, file);
    const outputPath = path.join(folderPath, file.replace(/\.csv$/i, '-flat.csv'));

    console.log(`[${i + 1}/${files.length}] Converting ${file} → week ${weekDate}...`);
    try {
      const count = await convertCSV(inputPath, weekDate, outputPath);
      console.log(`  ✅ ${count} exercises extracted\n`);
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}\n`);
    }
  }
}

async function batchConvertFromMapping(mappingPath) {
  const mapping = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(mappingPath)
      .pipe(parse({
        columns: true,
        skip_empty_lines: true
      }))
      .on('data', (row) => {
        mapping.push({
          filename: row.filename,
          weekStartDate: row.weekStartDate
        });
      })
      .on('end', async () => {
        const folderPath = path.dirname(mappingPath);
        console.log(`Processing ${mapping.length} files from mapping...\n`);

        for (let i = 0; i < mapping.length; i++) {
          const { filename, weekStartDate } = mapping[i];
          const inputPath = path.join(folderPath, filename);
          const outputPath = path.join(folderPath, filename.replace(/\.csv$/i, '-flat.csv'));

          if (!fs.existsSync(inputPath)) {
            console.error(`[${i + 1}/${mapping.length}] ❌ File not found: ${filename}\n`);
            continue;
          }

          console.log(`[${i + 1}/${mapping.length}] Converting ${filename} → week ${weekStartDate}...`);
          try {
            const count = await convertCSV(inputPath, weekStartDate, outputPath);
            console.log(`  ✅ ${count} exercises extracted\n`);
          } catch (error) {
            console.error(`  ❌ Error: ${error.message}\n`);
          }
        }
        resolve();
      })
      .on('error', reject);
  });
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage:');
    console.error('  node batchConvertWeeks.js <folder> <weekDate1> <weekDate2> ...');
    console.error('  node batchConvertWeeks.js --mapping <mapping.csv>');
    console.error('');
    console.error('Example:');
    console.error('  node batchConvertWeeks.js "/path/to/folder" "2026-01-04" "2026-01-11"');
    process.exit(1);
  }

  if (args[0] === '--mapping') {
    const mappingPath = path.resolve(args[1]);
    if (!fs.existsSync(mappingPath)) {
      console.error(`❌ Mapping file not found: ${mappingPath}`);
      process.exit(1);
    }
    batchConvertFromMapping(mappingPath)
      .then(() => console.log('\n✨ Batch conversion complete!'))
      .catch((error) => {
        console.error('❌ Error:', error.message);
        process.exit(1);
      });
  } else {
    const folderPath = path.resolve(args[0]);
    const weekDates = args.slice(1);

    if (!fs.existsSync(folderPath)) {
      console.error(`❌ Folder not found: ${folderPath}`);
      process.exit(1);
    }

    if (weekDates.length === 0) {
      console.error('❌ Please provide at least one weekStartDate');
      process.exit(1);
    }

    batchConvert(folderPath, weekDates)
      .then(() => console.log('\n✨ Batch conversion complete!'))
      .catch((error) => {
        console.error('❌ Error:', error.message);
        process.exit(1);
      });
  }
}

module.exports = { batchConvert, batchConvertFromMapping };
