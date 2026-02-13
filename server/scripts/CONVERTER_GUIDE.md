# Programming Sheet to Flat CSV Converter

Automated converter for importing 120+ weeks from "Programming Sheet SoulBox" format.

## Quick Start

### Single Week

```bash
cd server
npm run convert-sheet -- "/path/to/WEEK 199-Table 1.csv" "2026-01-04"
```

Output: `WEEK-2026-01-04-flat.csv` in the `server` directory.

### Batch Convert Multiple Weeks

**Option 1: List dates directly**
```bash
npm run batch-convert -- "/Users/olareda/Downloads/Programming Sheet SoulBox" \
  "2026-01-04" "2026-01-11" "2026-01-18" "2026-01-25" ...
```

**Option 2: Use a mapping CSV** (recommended for 120+ weeks)

1. Create `week-mapping.csv`:
```csv
filename,weekStartDate
WEEK 199-Table 1.csv,2026-01-04
WEEK 200-Table 1.csv,2026-01-11
WEEK 201-Table 1.csv,2026-01-18
...
```

2. Run:
```bash
npm run batch-convert -- --mapping "/path/to/week-mapping.csv"
```

## What It Does

- ✅ Reads "Programming Sheet SoulBox" CSV format (two days per row)
- ✅ Extracts exercises from Condition Zone A/B, Bag Work Zone, Technique Zone
- ✅ Maps to flat format: `weekStartDate, dayOfWeek, dayType, station, phase, slot, exerciseName, focus, isStatic, staticCondition`
- ✅ Handles special rule: **Monday/Wednesday/Saturday Station 3 = "Nonstop sparring"** (all slots A, B, C)
- ✅ Sets correct `dayType` and `focus` based on day of week
- ✅ Outputs tab-separated CSV ready for import

## After Conversion

Import each converted CSV:

```bash
npm run import-workouts -- "/path/to/WEEK-2026-01-04-flat.csv" "ola-reda@hotmail.co.uk"
```

Or batch import all:

```bash
for file in /path/to/folder/*-flat.csv; do
  npm run import-workouts -- "$file" "ola-reda@hotmail.co.uk"
done
```

## Week Start Date Calculation

Week start dates are **Sundays**. To find the week start date for a given week:

- Week 199 = week before 11/01/2026 → `2026-01-04`
- Week 200 = week of 11/01/2026 → `2026-01-11`
- etc.

Use a date calculator or spreadsheet to generate all 120+ dates.

## Tips

1. **Create the mapping CSV first** - it's easier to manage 120+ weeks in a spreadsheet
2. **Test with 1-2 weeks first** to verify the output looks correct
3. **Check for empty exercises** - some weeks might have `[FILL]` or empty cells that need manual review
4. **Import in chronological order** - helps with the 4-week no-repeat rule
