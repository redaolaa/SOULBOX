// Create TriSets from existing Saturday Station 1 workout data.
// Saturday has Phase 1 + Phase 2 (6 exercises) linked; order preserved from the data.
// Creates one tri-set per unique Phase1+Phase2 sequence from posted Saturdays.
//
// Usage:
//   node scripts/createTriSetsFromSaturdayWorkouts.js

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

    await TriSet.deleteMany({ userId, focus: 'Lower' });
    console.log('Cleared existing Saturday tri-sets.');

    const saturdayWorkouts = await Workout.find({ userId, dayOfWeek: 'Saturday' })
      .populate('station1.phase1.exerciseId')
      .populate('station1.phase2.exerciseId')
      .sort({ weekStartDate: 1 });

    const seenKeys = new Set();
    let created = 0;
    let skipped = 0;

    for (const w of saturdayWorkouts) {
      const phase1 = w.station1?.phase1 || [];
      const phase2 = w.station1?.phase2 || [];
      if (phase1.length !== 3 || phase2.length !== 3) {
        skipped++;
        continue;
      }

      const ids1 = phase1.map((s) => s?.exerciseId?._id || s?.exerciseId);
      const ids2 = phase2.map((s) => s?.exerciseId?._id || s?.exerciseId);
      if (ids1.some((id) => !id) || ids2.some((id) => !id)) {
        skipped++;
        continue;
      }

      const ex1 = await Exercise.find({ _id: { $in: ids1 }, userId });
      const ex2 = await Exercise.find({ _id: { $in: ids2 }, userId });
      if (ex1.length !== 3 || ex2.length !== 3) {
        skipped++;
        continue;
      }

      const validFocus1 = ex1.every((ex) => ex.station === 1 && ex.dayType === 'Technique' && ['Lower', 'Full Body'].includes(ex.focus));
      const validFocus2 = ex2.every((ex) => ex.station === 1 && ex.dayType === 'Technique' && ['Lower', 'Full Body'].includes(ex.focus));
      if (!validFocus1 || !validFocus2) {
        skipped++;
        continue;
      }

      const key = [...ids1.map(String), ...ids2.map(String)].join('|');
      if (seenKeys.has(key)) {
        skipped++;
        continue;
      }
      seenKeys.add(key);

      const orderMap1 = new Map(ids1.map((id, i) => [id.toString(), i]));
      const orderMap2 = new Map(ids2.map((id, i) => [id.toString(), i]));
      const ordered1 = [...ex1].sort((a, b) => orderMap1.get(a._id.toString()) - orderMap1.get(b._id.toString()));
      const ordered2 = [...ex2].sort((a, b) => orderMap2.get(a._id.toString()) - orderMap2.get(b._id.toString()));
      const exerciseIds = ordered1.map((ex) => ex._id);
      const phase2ExerciseIds = ordered2.map((ex) => ex._id);
      const concept = ordered1[0]?.name?.slice(0, 40) || 'Saturday set';
      const p1Names = ordered1.map((ex) => ex.name).join(' | ');
      const p2Names = ordered2.map((ex) => ex.name).join(' | ');

      await TriSet.create({
        userId,
        dayType: 'Technique',
        focus: 'Lower',
        concept,
        name: '',
        exerciseIds,
        phase2ExerciseIds
      });
      created++;
      console.log('Phase 1:', p1Names);
      console.log('Phase 2:', p2Names);
      console.log('---');
    }

    const total = await TriSet.countDocuments({ userId, focus: 'Lower' });
    console.log(`\n✅ Done. Created ${created} tri-set(s), skipped ${skipped}. Total Saturday tri-sets: ${total}.`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
