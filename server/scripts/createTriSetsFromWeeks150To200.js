// Create Monday Station 1 tri-sets from weeks 150–200.
// Each tri-set = one full Monday Station 1: Phase 1 (3 exercises) + Phase 2 (3 exercises) in the same sequence.
// Selecting that tri-set in the app fills both Phase 1 and Phase 2 in order, as one option for a future week.
// Week number: week beginning Jan 11 2026 = Week 200 (same as Calendar).
//
// Usage:
//   node scripts/createTriSetsFromWeeks150To200.js
//   node scripts/createTriSetsFromWeeks150To200.js user@email.com

require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../models/User');
const Exercise = require('../models/Exercise');
const Workout = require('../models/Workout');
const TriSet = require('../models/TriSet');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/soulbox';

const WEEK_MIN = 150;
const WEEK_MAX = 200;

function getProgramWeekNumber(weekStartDate) {
  const anchor = new Date(2026, 0, 11);
  anchor.setHours(0, 0, 0, 0);
  const ws = new Date(weekStartDate);
  ws.setHours(0, 0, 0, 0);
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return 200 + Math.round((ws.getTime() - anchor.getTime()) / msPerWeek);
}

function inWeekRange(weekStartDate) {
  const w = getProgramWeekNumber(weekStartDate);
  return w >= WEEK_MIN && w <= WEEK_MAX;
}

async function connect() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');
}

async function main() {
  try {
    await connect();

    const emailArg = process.argv[2];
    const user = emailArg
      ? await User.findOne({ email: emailArg.trim().toLowerCase() })
      : await User.findOne({ username: 'ola' }) || await User.findOne();
    if (!user) throw new Error('No user found.');
    const userId = user._id;
    console.log(`Using user: ${user.username || user.email} (${user.email})\n`);
    console.log(`Building Monday Station 1 tri-sets (Phase 1 + Phase 2 as one option) from weeks ${WEEK_MIN}–${WEEK_MAX}.\n`);

    await TriSet.deleteMany({ userId, focus: 'Mixed' });
    console.log('Cleared existing Monday (Mixed) tri-sets.');

    const mondayWorkouts = await Workout.find({ userId, dayOfWeek: 'Monday' })
      .populate('station1.phase1.exerciseId')
      .populate('station1.phase2.exerciseId')
      .sort({ weekStartDate: 1 });

    const mondayInRange = mondayWorkouts.filter((w) => inWeekRange(w.weekStartDate));
    console.log(`Monday workouts in weeks ${WEEK_MIN}–${WEEK_MAX}: ${mondayInRange.length} (of ${mondayWorkouts.length} total).\n`);

    const seenKey = new Set();
    let created = 0;

    for (const w of mondayInRange) {
      const phase1 = w.station1?.phase1 || [];
      const phase2 = w.station1?.phase2 || [];
      if (phase1.length !== 3 || phase2.length !== 3) continue;

      const ids1 = phase1.map((s) => s?.exerciseId?._id || s?.exerciseId);
      const ids2 = phase2.map((s) => s?.exerciseId?._id || s?.exerciseId);
      if (ids1.some((id) => !id) || ids2.some((id) => !id)) continue;

      const unique1 = [...new Set(ids1.map(String))];
      const unique2 = [...new Set(ids2.map(String))];
      const exById1 = await Exercise.find({ _id: { $in: unique1.map((id) => new mongoose.Types.ObjectId(id)) } }).then((list) => new Map(list.map((e) => [e._id.toString(), e])));
      const exById2 = await Exercise.find({ _id: { $in: unique2.map((id) => new mongoose.Types.ObjectId(id)) } }).then((list) => new Map(list.map((e) => [e._id.toString(), e])));
      const ordered1 = ids1.map((id) => exById1.get(id.toString())).filter(Boolean);
      const ordered2 = ids2.map((id) => exById2.get(id.toString())).filter(Boolean);
      if (ordered1.length !== 3 || ordered2.length !== 3) continue;
      if (ordered1.some((e) => e.userId.toString() !== userId.toString()) || ordered2.some((e) => e.userId.toString() !== userId.toString())) continue;

      const valid1 = ordered1.every((ex) => ex.station === 1 && ex.dayType === 'Technique' && ['Mixed', 'Full Body'].includes(ex.focus));
      const valid2 = ordered2.every((ex) => ex.station === 1 && ex.dayType === 'Technique' && ['Mixed', 'Full Body'].includes(ex.focus));
      if (!valid1 || !valid2) continue;

      const key = [...ids1.map(String), ...ids2.map(String)].join('|');
      if (seenKey.has(key)) continue;
      seenKey.add(key);
      const exerciseIds = ordered1.map((ex) => ex._id);
      const phase2ExerciseIds = ordered2.map((ex) => ex._id);

      const weekNum = getProgramWeekNumber(w.weekStartDate);
      const p2First = (ordered2[0]?.name || '').trim().slice(0, 35);
      const concept = p2First ? `Week ${weekNum}: ${p2First}` : `Week ${weekNum}`;

      await TriSet.create({
        userId,
        dayType: 'Technique',
        focus: 'Mixed',
        concept,
        name: '',
        exerciseIds,
        phase2ExerciseIds
      });
      created++;
      console.log(`Week ${weekNum} — Phase 1: ${ordered1.map((e) => e.name).join(' | ')}`);
      console.log(`         Phase 2: ${ordered2.map((e) => e.name).join(' | ')}`);
      console.log('---');
    }

    const total = await TriSet.countDocuments({ userId, focus: 'Mixed' });
    console.log(`\n✅ Done. Created ${created} tri-set(s). Each is Phase 1 + Phase 2 in sequence (one option per unique 6-exercise set). Total Mixed: ${total}.`);
    console.log(`(The built-in "ATT/DEF + Phase 2 progression" is recreated by the app when you open the dropdown.)`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
