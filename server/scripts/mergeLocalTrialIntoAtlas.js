// When you're ready to "combine": add your LOCAL trial user's exercises into the
// Atlas user (e.g. shebtini) WITHOUT removing or overwriting what's already on Atlas.
// So: Shebtini's edits on Render stay. Any NEW exercises you added locally get added to her account.
//
// Usage:
//   MONGODB_URI_ATLAS="mongodb+srv://..." node scripts/mergeLocalTrialIntoAtlas.js
//   MONGODB_URI_ATLAS="mongodb+srv://..." node scripts/mergeLocalTrialIntoAtlas.js shebtinitrial@trial.com

require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../models/User');
const Exercise = require('../models/Exercise');

const LOCAL_URI = process.env.MONGODB_URI_LOCAL || process.env.MONGODB_URI || 'mongodb://localhost:27017/soulbox';
const ATLAS_URI = process.env.MONGODB_URI_ATLAS;

if (!ATLAS_URI) {
  console.error('Set MONGODB_URI_ATLAS. Example: MONGODB_URI_ATLAS="mongodb+srv://..." node scripts/mergeLocalTrialIntoAtlas.js [atlas-email]');
  process.exit(1);
}

function exerciseKey(ex) {
  return [ex.name, ex.station, ex.dayType].join('|');
}

async function main() {
  const atlasEmail = (process.argv[2] || 'shebtinitrial@trial.com').trim().toLowerCase();

  try {
    // 1. Read from LOCAL (trial user's exercises)
    await mongoose.connect(LOCAL_URI);
    const localTrial = await User.findOne({ email: 'trial@example.com' });
    if (!localTrial) {
      throw new Error('Local trial user (trial@example.com) not found.');
    }
    const localExercises = await Exercise.find({ userId: localTrial._id }).lean();
    console.log(`Local trial: ${localExercises.length} exercises`);
    await mongoose.disconnect();

    // 2. Connect to ATLAS and get target user's existing exercises
    await mongoose.connect(ATLAS_URI);
    const atlasUser = await User.findOne({ email: atlasEmail });
    if (!atlasUser) {
      throw new Error(`Atlas user "${atlasEmail}" not found. They must have an account on Render.`);
    }
    const existingAtlas = await Exercise.find({ userId: atlasUser._id }).lean();
    const existingKeys = new Set(existingAtlas.map(ex => exerciseKey(ex)));
    console.log(`Atlas ${atlasEmail}: ${existingAtlas.length} exercises already`);

    let added = 0;
    for (const ex of localExercises) {
      const key = exerciseKey(ex);
      if (existingKeys.has(key)) continue;
      await Exercise.create({
        name: ex.name,
        station: ex.station,
        focus: ex.focus,
        dayType: ex.dayType,
        isStatic: ex.isStatic,
        staticCondition: ex.staticCondition,
        userId: atlasUser._id
      });
      existingKeys.add(key);
      added++;
    }

    await mongoose.disconnect();
    console.log(`\nDone. Added ${added} new exercise(s) to ${atlasEmail} on Atlas. Her existing data was not changed.`);
    process.exit(0);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  } finally {
    try { await mongoose.disconnect(); } catch (_) {}
  }
}

main();
