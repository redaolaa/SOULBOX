// Copy an Atlas user's data (e.g. shebtini) INTO your local trial user.
// Use this when you want to "combine into local" – pull her current state from Render
// into your local trial user. Local trial will be REPLACED with her exercises/workouts/tri-sets.
//
// Usage:
//   MONGODB_URI_ATLAS="mongodb+srv://..." node scripts/copyAtlasUserToLocal.js
//   MONGODB_URI_ATLAS="mongodb+srv://..." node scripts/copyAtlasUserToLocal.js shebtinitrial@trial.com

require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../models/User');
const Exercise = require('../models/Exercise');
const Workout = require('../models/Workout');
const TriSet = require('../models/TriSet');

const LOCAL_URI = process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI || 'mongodb://localhost:27017/soulbox';
const ATLAS_URI = process.env.MONGODB_URI_ATLAS;

if (!ATLAS_URI) {
  console.error('Set MONGODB_URI_ATLAS. Example: MONGODB_URI_ATLAS="mongodb+srv://..." node scripts/copyAtlasUserToLocal.js [atlas-email]');
  process.exit(1);
}

function mapId(id, idMap) {
  if (!id) return null;
  const str = id.toString();
  return idMap.get(str) || id;
}

async function main() {
  const atlasEmail = (process.argv[2] || 'shebtinitrial@trial.com').trim().toLowerCase();

  try {
    // 1. Read from ATLAS (source user)
    await mongoose.connect(ATLAS_URI);
    const atlasUser = await User.findOne({ email: atlasEmail }).lean();
    if (!atlasUser) {
      throw new Error(`Atlas user "${atlasEmail}" not found.`);
    }
    const atlasId = atlasUser._id;
    const exercisesData = await Exercise.find({ userId: atlasId }).lean();
    const workoutsData = await Workout.find({ userId: atlasId }).lean();
    const triSetsData = await TriSet.find({ userId: atlasId }).lean();
    console.log(`Atlas ${atlasEmail}: ${exercisesData.length} exercises, ${workoutsData.length} workouts, ${triSetsData.length} tri-sets`);
    await mongoose.disconnect();

    // 2. Write to LOCAL (trial user – replace their data)
    await mongoose.connect(LOCAL_URI);
    let localTrial = await User.findOne({ email: 'trial@example.com' });
    if (!localTrial) {
      localTrial = await User.create({
        username: 'trial',
        email: 'trial@example.com',
        password: 'Trial123!',
        name: 'Trial (from Atlas)'
      });
      console.log('Created local trial user.');
    } else {
      await Exercise.deleteMany({ userId: localTrial._id });
      await Workout.deleteMany({ userId: localTrial._id });
      await TriSet.deleteMany({ userId: localTrial._id });
    }
    const newId = localTrial._id;
    const idMap = new Map();

    for (const ex of exercisesData) {
      const created = await Exercise.create({
        name: ex.name,
        station: ex.station,
        focus: ex.focus,
        dayType: ex.dayType,
        isStatic: ex.isStatic || false,
        staticCondition: ex.staticCondition || null,
        userId: newId
      });
      idMap.set(String(ex._id), created._id);
    }
    console.log(`Copied ${exercisesData.length} exercises.`);

    const mapSlot = (slot) => {
      if (!slot || !slot.exerciseId) return slot;
      return { exerciseId: mapId(slot.exerciseId, idMap), name: slot.name };
    };
    const mapSlots = (arr) => (Array.isArray(arr) ? arr.map(mapSlot) : []);
    for (const w of workoutsData) {
      const s1 = w.station1 || {};
      await Workout.create({
        userId: newId,
        dayOfWeek: w.dayOfWeek,
        dayType: w.dayType,
        filter: w.filter,
        weekStartDate: w.weekStartDate,
        station1: { phase1: mapSlots(s1.phase1), phase2: mapSlots(s1.phase2) },
        station2: mapSlots(w.station2),
        station3: mapSlots(w.station3)
      });
    }
    console.log(`Copied ${workoutsData.length} workouts.`);

    const mapIds = (arr) => (Array.isArray(arr) ? arr.map((id) => mapId(id, idMap)).filter(Boolean) : []);
    for (const ts of triSetsData) {
      await TriSet.create({
        userId: newId,
        dayType: ts.dayType,
        focus: ts.focus,
        name: ts.name || '',
        concept: ts.concept || '',
        exerciseIds: mapIds(ts.exerciseIds),
        phase2ExerciseIds: mapIds(ts.phase2ExerciseIds),
        lastUsed: ts.lastUsed || null
      });
    }
    console.log(`Copied ${triSetsData.length} tri-sets.`);

    await mongoose.disconnect();
    console.log('\nDone. Local trial user now has a copy of ' + atlasEmail + "'s data from Atlas.");
    process.exit(0);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  } finally {
    try { await mongoose.disconnect(); } catch (_) {}
  }
}

main();
