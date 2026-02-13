# Exercise Import Script

This script imports exercises from the example week's workouts into your database.

## Usage

```bash
# Import exercises for the first user in the database
npm run import-exercises

# Or import for a specific user ID
node scripts/importExercises.js <userId>
```

## What it does

- Imports all exercises from the example week (Sunday through Saturday)
- Organizes exercises by:
  - Station (1, 2, or 3)
  - Focus (Upper, Lower, Mixed, Full Body)
  - Day Type (Kickboxing, Boxing, Technique, Conditioning)
- Sets up static exercises (e.g., "Non-stop Sparring" for Station 3, position B)
- Skips duplicates if exercises already exist

## Exercise Count

The script imports approximately 100+ exercises covering:
- **Sunday (Kickboxing - Upper)**: 12 exercises
- **Monday (Technique - Mixed)**: 12 exercises
- **Tuesday (Boxing - Upper)**: 12 exercises
- **Wednesday (Conditioning - Lower)**: 15 exercises
- **Thursday (Kickboxing - Mixed)**: 12 exercises
- **Saturday (Technique - Lower)**: 12 exercises

Total: ~75+ unique exercises across all stations and day types.
