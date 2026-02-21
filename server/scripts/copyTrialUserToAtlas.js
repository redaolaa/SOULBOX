// Copy the trial user's data from LOCAL MongoDB to an account on ATLAS.
// After you register on the Render app, run this with your email to copy all data into that account.
//
// Usage (run from server folder):
//   MONGODB_URI_ATLAS="mongodb+srv://..." node scripts/copyTrialUserToAtlas.js
//   MONGODB_URI_ATLAS="mongodb+srv://..." node scripts/copyTrialUserToAtlas.js your@email.com
//
// No email: copies into trial@example.com on Atlas (creates that user if needed).
// With email: copies into the account you registered (you must register that email on Render first).

require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../models/User');
const Exercise = require('../models/Exercise');
const Workout = require('../models/Workout');
const TriSet = require('../models/TriSet');

const LOCAL_URI = process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI || 'mongodb://localhost:27017/soulbox';
const ATLAS_URI = process.env.MONGODB_URI_ATLAS;

if (!ATLAS_URI) {
  console.error('Set MONGODB_URI_ATLAS to your Atlas connection string.');
  console.error('Example: MONGODB_URI_ATLAS="mongodb+srv://..." node scripts/copyTrialUserToAtlas.js');
  process.exit(1);
}

function mapId(id, idMap) {
  if (!id) return null;
  const str = id.toString();
  return idMap.get(str) || id;
}

async function main() {
  try {
    // ---- 1. Read from LOCAL ----
    await mongoose.connect(LOCAL_URI);
    console.log('Connected to LOCAL MongoDB');

    const sourceUser = await User.findOne({ email: 'trial@example.com' });
    if (!sourceUser) {
      throw new Error('Trial user (trial@example.com) not found in local database. Run copyUserDataToTrial.js locally first.');
    }
    const sourceId = sourceUser._id;

    const exercisesData = await Exercise.collection.find({ userId: sourceId }).toArray();
    const workoutsData = await Workout.find({ userId: sourceId }).lean();
    const triSetsData = await TriSet.find({ userId: sourceId }).lean();

    console.log(`Local: ${exercisesData.length} exercises, ${workoutsData.length} workouts, ${triSetsData.length} tri-sets`);
    await mongoose.disconnect();
    console.log('Disconnected from LOCAL\n');

    // ---- 2. Write to ATLAS ----
    await mongoose.connect(ATLAS_URI);
    console.log('Connected to ATLAS MongoDB');

    const targetEmail = (process.argv[2] || '').trim().toLowerCase() || 'trial@example.com';
    let atlasUser = await User.findOne({ email: targetEmail });

    if (!atlasUser) {
      if (targetEmail === 'trial@example.com') {
        atlasUser = await User.create({
          username: 'trial',
          email: 'trial@example.com',
          password: 'Trial123!',
          name: 'Trial'
        });
        console.log('Created trial user on Atlas');
      } else {
        throw new Error(`No user with email "${targetEmail}" on Atlas. Register that email on the Render app first, then run this script again.`);
      }
    } else {
      console.log(`Found user ${targetEmail} on Atlas; copying data into their account.`);
      await Exercise.deleteMany({ userId: atlasUser._id });
      await Workout.deleteMany({ userId: atlasUser._id });
      await TriSet.deleteMany({ userId: atlasUser._id });
    }
    const newId = atlasUser._id;
    const idMap = new Map();

    // Copy exercises
    for (const ex of exercisesData) {
      const { _id, userId, ...rest } = ex;
      const inserted = await Exercise.collection.insertOne({
        ...rest,
        userId: newId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      idMap.set(_id.toString(), inserted.insertedId);
    }
    console.log(`Copied ${exercisesData.length} exercise(s).`);

    // Copy workouts
    for (const w of workoutsData) {
      const mapSlot = (slot) => {
        if (!slot || !slot.exerciseId) return slot;
        const newExId = mapId(slot.exerciseId, idMap);
        return { exerciseId: newExId, name: slot.name };
      };
      const mapSlots = (arr) => (Array.isArray(arr) ? arr.map(mapSlot) : []);
      const station1 = w.station1 || {};
      await Workout.create({
        userId: newId,
        dayOfWeek: w.dayOfWeek,
        dayType: w.dayType,
        filter: w.filter,
        weekStartDate: w.weekStartDate,
        station1: {
          phase1: mapSlots(station1.phase1),
          phase2: mapSlots(station1.phase2)
        },
        station2: mapSlots(w.station2),
        station3: mapSlots(w.station3)
      });
    }
    console.log(`Copied ${workoutsData.length} workout(s).`);

    // Copy tri-sets
    for (const ts of triSetsData) {
      const mapIds = (arr) =>
        (Array.isArray(arr) ? arr.map((id) => mapId(id, idMap)).filter(Boolean) : []);
      await TriSet.create({
        userId: newId,
        dayType: ts.dayType || 'Technique',
        focus: ts.focus,
        name: ts.name || '',
        concept: ts.concept || '',
        exerciseIds: mapIds(ts.exerciseIds),
        phase2ExerciseIds: mapIds(ts.phase2ExerciseIds),
        lastUsed: ts.lastUsed || null
      });
    }
    console.log(`Copied ${triSetsData.length} tri-set(s).`);

    await mongoose.disconnect();
    console.log('\nDone. Log in on the Render app with the email and password you registered.');
    if (targetEmail === 'trial@example.com') {
      console.log('  Email: trial@example.com  Password: Trial123!');
    }
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    try {
      await mongoose.disconnect();
    } catch (_) {}
  }
}

main();
