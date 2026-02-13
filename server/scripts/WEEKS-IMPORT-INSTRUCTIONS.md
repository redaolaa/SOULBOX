# Combined weeks import (199 → 170)

## What the cleaner does

1. **Strips section headers**  
   Removes lines like `week 199-195..`, `week 194 to 190:`, `weeks 189 to 185:`, etc., and duplicate header rows.

2. **Removes only erroneous 2025-12-14 rows**  
   Drops the misplaced Wednesday Conditioning Station 3 (Nonstop sparring) rows that appear in the middle of other weeks (2025-09-21, 2025-09-14, 2025-09-07, 2025-11-16). The correct 2025-12-14 week block is kept.

3. **Outputs one clean CSV**  
   Single header row and all data rows in the flat format the importer expects.

## Steps

1. **Create the raw paste file**  
   Create `server/WEEKS-199-to-170-raw-paste.txt` and paste your full data into it (from the line that starts with `week 199-195..` through the end of the last section, e.g. `Weeks 174 to 170`). Save the file.

2. **Run the cleaner**  
   From `server/`:
   ```bash
   node scripts/cleanCombinedWeeksPaste.js WEEKS-199-to-170-raw-paste.txt
   ```
   This creates `WEEKS-199-to-170-raw-paste-cleaned.csv`.

3. **Import into the app**  
   From `server/`:
   ```bash
   node scripts/importWorkoutsFromCsv.js WEEKS-199-to-170-raw-paste-cleaned.csv
   ```

## Test

A small test file is at `server/WEEKS-199-to-170-test.txt`. Run:
```bash
node scripts/cleanCombinedWeeksPaste.js WEEKS-199-to-170-test.txt
```
Then inspect `WEEKS-199-to-170-test-cleaned.csv` to confirm erroneous 2025-12-14 blocks are removed and section headers are stripped.
