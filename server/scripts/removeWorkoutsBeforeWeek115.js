// Remove all workouts and related exercises from week 114 and before.
// Keeps only data from week 115 onwards.
//
// Week numbering: Week 100 = 2024-02-11. Week N = 2024-02-11 + (N-100)*7 days.
// Week 115 starts: 2024-05-26 (Sunday)
//
// Usage:
//   node scripts/removeWorkoutsBeforeWeek115.js
//   node scripts/removeWorkoutsBeforeWeek115.js user@email.com

require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../models/User');
const Exercise = require('../models/Exercise');
const Workout = require('../models/Workout');
const TriSet = require('../models/TriSet');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/soulbox';

const WEEK_115_START = new Date('2024-05-26');

async function connect() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');
}

async function main() {
  try {
    await connect();

    const emailFromArg = process.argv[2];
    let user;
    if (emailFromArg) {
      user = await User.findOne({ email: emailFromArg.trim().toLowerCase() });
      if (!user) throw new Error(`No user found with email ${emailFromArg}`);
    } else {
      user = await User.findOne({ username: 'ola' }) || await User.findOne();
    }
    if (!user) throw new Error('No users found.');
    const userId = user._id;
    console.log(`Using user: ${user.username} (${user.email})`);

    const deletedWorkouts = await Workout.deleteMany({
      userId,
      weekStartDate: { $lt: WEEK_115_START }
    });
    console.log(`Deleted ${deletedWorkouts.deletedCount} workout(s) from week 114 and before.`);

    const remainingWorkouts = await Workout.find({ userId }).select('station1 station2 station3');
    const usedExerciseIds = new Set();
    for (const w of remainingWorkouts) {
      const collect = (arr) => {
        (arr || []).forEach((slot) => {
          if (slot?.exerciseId) usedExerciseIds.add(slot.exerciseId.toString());
        });
      };
      if (w.station1?.phase1) collect(w.station1.phase1);
      if (w.station1?.phase2) collect(w.station1.phase2);
      if (w.station2) collect(w.station2);
      if (w.station3) collect(w.station3);
    }

    const triSets = await TriSet.find({ userId }).select('exerciseIds');
    for (const ts of triSets) {
      (ts.exerciseIds || []).forEach((id) => {
        if (id) usedExerciseIds.add(id.toString());
      });
    }

    const orphanedExercises = await Exercise.find({
      userId,
      _id: { $nin: [...usedExerciseIds] }
    });
    const deletedExercises = await Exercise.deleteMany({
      userId,
      _id: { $nin: [...usedExerciseIds] }
    });
    console.log(`Deleted ${deletedExercises.deletedCount} exercise(s) no longer used in week 115+ workouts.`);

    const remainingCount = await Workout.countDocuments({ userId });
    const exerciseCount = await Exercise.countDocuments({ userId });
    console.log(`Remaining: ${remainingCount} workout(s), ${exerciseCount} exercise(s).`);
    console.log('✅ Cleanup complete. Only week 115 onwards data kept.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
