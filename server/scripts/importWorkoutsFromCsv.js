// Import full weekly workouts for a single user from a CSV file.
//
// Usage:
//   node scripts/importWorkoutsFromCsv.js path/to/file.csv userEmail
//   # or (will try to find user with username 'ola' if email omitted)
//   node scripts/importWorkoutsFromCsv.js path/to/file.csv
//
// CSV columns (header row required):
//   weekStartDate,dayOfWeek,dayType,station,phase,slot,exerciseName,focus,isStatic,staticCondition
//   - weekStartDate: 2026-01-05 (ISO or anything Date() can parse)
//   - dayOfWeek: Sunday, Monday, Tuesday, Wednesday, Thursday, Saturday
//   - dayType: Kickboxing, Boxing, Technique, Conditioning
//   - station: 1,2,3
//   - phase: 1 or 2 (only for station 1, otherwise leave blank)
//   - slot: A,B,C (position within the station)
//   - exerciseName: text of the exercise
//   - focus: Upper, Lower, Mixed, Full Body (optional but useful)
//   - isStatic: TRUE/FALSE (optional)
//   - staticCondition: e.g. kickboxing-station3-b (optional)

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { parse } = require('csv-parse');

const User = require('../models/User');
const Exercise = require('../models/Exercise');
const Workout = require('../models/Workout');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/soulbox';

async function connect() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');
}

function parseBool(value) {
  if (!value) return false;
  const v = String(value).trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

function slotIndex(slot) {
  if (!slot) return 0;
  const s = String(slot).trim().toUpperCase();
  if (s === 'A') return 0;
  if (s === 'B') return 1;
  if (s === 'C') return 2;
  return 0;
}

function normalizeFocus(focus) {
  if (!focus) return 'Mixed';
  const f = String(focus).trim().toLowerCase();
  if (f.startsWith('upper')) return 'Upper';
  if (f.startsWith('lower')) return 'Lower';
  if (f.startsWith('mixed')) return 'Mixed';
  if (f.startsWith('full')) return 'Full Body';
  return 'Mixed';
}

// Map dayType + your existing config to filter
function deriveFilter(dayType, dayOfWeek) {
  // Match the DAY_CONFIG you already use
  if (dayOfWeek === 'Sunday') return 'Upper Body';
  if (dayOfWeek === 'Tuesday') return 'Upper Body';
  if (dayOfWeek === 'Wednesday') return 'Lower Body';
  if (dayOfWeek === 'Thursday') return 'Mixed/Full Body';
  if (dayOfWeek === 'Monday') return 'Mixed/Full Body';
  if (dayOfWeek === 'Saturday') return 'Lower Body';
  // Fallback
  return 'Mixed/Full Body';
}

async function getTargetUser(emailFromArg) {
  if (emailFromArg) {
    const user = await User.findOne({ email: emailFromArg.trim().toLowerCase() });
    if (!user) {
      throw new Error(`No user found with email ${emailFromArg}`);
    }
    console.log(`Using user by email: ${user.email} (username: ${user.username})`);
    return user;
  }

  // No email provided: try username 'ola'
  let user = await User.findOne({ username: 'ola' });
  if (!user) {
    // Fallback to first user
    user = await User.findOne();
  }
  if (!user) {
    throw new Error('No users found. Please register a user first.');
  }
  console.log(`Using user: ${user.username} (${user.email})`);
  return user;
}

async function findOrCreateExercise(userId, row) {
  const station = Number(row.station);
  const dayType = row.dayType;
  const name = row.exerciseName;

  const focus = normalizeFocus(row.focus);
  const isStatic = parseBool(row.isStatic);
  let staticCondition = row.staticCondition || null;
  if (!isStatic || (staticCondition && String(staticCondition).trim().toUpperCase() === 'FALSE')) {
    staticCondition = null;
  }

  let exercise = await Exercise.findOne({
    userId,
    name,
    station,
    dayType
  });

  if (exercise) {
    return exercise;
  }

  exercise = new Exercise({
    userId,
    name,
    station,
    dayType,
    focus,
    isStatic,
    staticCondition
  });

  await exercise.save();
  return exercise;
}

async function importWorkouts(csvPath, user) {
  return new Promise((resolve, reject) => {
    const absPath = path.resolve(csvPath);
    if (!fs.existsSync(absPath)) {
      return reject(new Error(`CSV file not found: ${absPath}`));
    }

    const workoutsMap = new Map();
    const rowPromises = [];

    fs.createReadStream(absPath)
      .pipe(parse({
        columns: true,
        trim: true,
        skip_empty_lines: true,
        relax_column_count: true
      }))
      .on('data', (row) => {
        // Queue async processing so we can await all rows before writing to DB
        rowPromises.push((async () => {
          try {
            const dayOfWeek = row.dayOfWeek;
            const dayType = row.dayType;
            const station = Number(row.station);
            const phase = row.phase ? Number(row.phase) : null;
            const slot = row.slot;
            const exerciseName = row.exerciseName;

            if (!dayOfWeek || !dayType || !station || !exerciseName) {
              return;
            }

            const weekStartDate = new Date(row.weekStartDate);
            const key = `${weekStartDate.toISOString().substring(0, 10)}|${dayOfWeek}|${dayType}`;

            if (!workoutsMap.has(key)) {
              workoutsMap.set(key, {
                userId: user._id,
                dayOfWeek,
                dayType,
                filter: deriveFilter(dayType, dayOfWeek),
                weekStartDate,
                station1: { phase1: [null, null, null], phase2: [null, null, null] },
                station2: [null, null, null],
                station3: [null, null, null]
              });
            }

            const workout = workoutsMap.get(key);

            const exercise = await findOrCreateExercise(user._id, row);
            const entry = { exerciseId: exercise._id, name: exercise.name };
            const idx = slotIndex(slot);

            if (station === 1) {
              const ph = phase === 2 ? 'phase2' : 'phase1';
              workout.station1[ph][idx] = entry;
            } else if (station === 2) {
              workout.station2[idx] = entry;
            } else if (station === 3) {
              workout.station3[idx] = entry;
            }
          } catch (err) {
            console.error('Error processing row:', err.message);
          }
        })());
      })
      .on('error', (err) => {
        reject(err);
      })
      .on('end', async () => {
        try {
          // Ensure all rows have been processed
          await Promise.all(rowPromises);

          let created = 0;
          for (const [key, data] of workoutsMap.entries()) {
            const doc = {
              userId: data.userId,
              dayOfWeek: data.dayOfWeek,
              dayType: data.dayType,
              filter: data.filter,
              weekStartDate: data.weekStartDate,
              station1: {
                phase1: data.station1.phase1.filter(Boolean),
                phase2: data.station1.phase2.filter(Boolean)
              },
              station2: data.station2.filter(Boolean),
              station3: data.station3.filter(Boolean)
            };

            await Workout.findOneAndUpdate(
              {
                userId: data.userId,
                dayOfWeek: data.dayOfWeek,
                weekStartDate: data.weekStartDate
              },
              doc,
              { upsert: true, new: true }
            );
            created++;
          }
          console.log(`Imported/updated ${created} workout(s).`);
          resolve();
        } catch (err) {
          reject(err);
        }
      });
  });
}

async function main() {
  try {
    const csvPath = process.argv[2];
    const userEmail = process.argv[3];

    if (!csvPath) {
      console.error('Usage: node scripts/importWorkoutsFromCsv.js path/to/file.csv [userEmail]');
      process.exit(1);
    }

    await connect();
    const user = await getTargetUser(userEmail);
    await importWorkouts(csvPath, user);
    console.log('✅ Workout import complete.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error importing workouts:', err);
    process.exit(1);
  }
}

main();

