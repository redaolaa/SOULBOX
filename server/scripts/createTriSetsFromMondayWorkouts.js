// Create TriSets from existing Monday Station 1 workout data.
// Monday has one phase only: 3 exercises in a fixed sequence, selected together.
// Uses station1.phase1 only; order is preserved from the data.
// Creates one tri-set per unique sequence (same 3 IDs in same order).
//
// Usage:
//   node scripts/createTriSetsFromMondayWorkouts.js

require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../models/User');
const Exercise = require('../models/Exercise');
const Workout = require('../models/Workout');
const TriSet = require('../models/TriSet');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/soulbox';

async function connect() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');
}

async function main() {
  try {
    await connect();

    const user = await User.findOne({ username: 'ola' }) || await User.findOne();
    if (!user) throw new Error('No users found.');
    const userId = user._id;
    console.log(`Using user: ${user.username} (${user.email})`);

    await TriSet.deleteMany({ userId, focus: 'Mixed' });
    console.log('Cleared existing Monday tri-sets.');

    const mondayWorkouts = await Workout.find({ userId, dayOfWeek: 'Monday' })
      .populate('station1.phase1.exerciseId')
      .sort({ weekStartDate: 1 });

    const seenKeys = new Set();
    let created = 0;
    let skipped = 0;

    for (const w of mondayWorkouts) {
      const phase1 = w.station1?.phase1 || [];
      if (phase1.length !== 3) {
        skipped++;
        continue;
      }

      const ids1 = phase1.map((s) => s?.exerciseId?._id || s?.exerciseId);
      if (ids1.some((id) => !id)) {
        skipped++;
        continue;
      }

      const ex1 = await Exercise.find({ _id: { $in: ids1 }, userId });
      if (ex1.length !== 3) {
        skipped++;
        continue;
      }

      const validFocus = ex1.every((ex) => ex.station === 1 && ex.dayType === 'Technique' && ['Mixed', 'Full Body'].includes(ex.focus));
      if (!validFocus) {
        skipped++;
        continue;
      }

      const key = ids1.map(String).join('|');
      if (seenKeys.has(key)) {
        skipped++;
        continue;
      }
      seenKeys.add(key);

      const orderMap = new Map(ids1.map((id, i) => [id.toString(), i]));
      const ordered = [...ex1].sort((a, b) => orderMap.get(a._id.toString()) - orderMap.get(b._id.toString()));
      const exerciseIds = ordered.map((ex) => ex._id);
      const concept = ordered[0]?.name?.slice(0, 40) || 'Monday set';
      const names = ordered.map((ex) => ex.name).join(' | ');

      await TriSet.create({
        userId,
        dayType: 'Technique',
        focus: 'Mixed',
        concept,
        name: '',
        exerciseIds
      });
      created++;
      console.log(names);
    }

    const total = await TriSet.countDocuments({ userId, focus: 'Mixed' });
    console.log(`\n✅ Done. Created ${created} tri-set(s), skipped ${skipped}. Total Monday tri-sets: ${total}.`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
