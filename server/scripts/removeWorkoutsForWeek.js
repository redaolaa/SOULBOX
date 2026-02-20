// Remove all workouts for a specific program week (e.g. 181).
// Week numbering matches Calendar: week beginning Jan 11 2026 = Week 200.
// Week N start = 2026-01-11 + (N - 200) * 7 days.
//
// Usage:
//   node scripts/removeWorkoutsForWeek.js 181
//   node scripts/removeWorkoutsForWeek.js 181 user@email.com

require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../models/User');
const Workout = require('../models/Workout');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/soulbox';

function getWeekStartDate(weekNumber) {
  const anchor = new Date(2026, 0, 11); // Jan 11, 2026
  anchor.setHours(0, 0, 0, 0);
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const start = new Date(anchor.getTime() + (Number(weekNumber) - 200) * msPerWeek);
  start.setHours(0, 0, 0, 0);
  return start;
}

async function connect() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');
}

async function main() {
  const weekNum = process.argv[2];
  if (!weekNum || !/^\d+$/.test(weekNum)) {
    console.error('Usage: node scripts/removeWorkoutsForWeek.js <weekNumber> [userEmail]');
    console.error('Example: node scripts/removeWorkoutsForWeek.js 181');
    process.exit(1);
  }

  const weekStart = getWeekStartDate(weekNum);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  try {
    await connect();

    const emailFromArg = process.argv[3];
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
    console.log(`Week ${weekNum}: ${weekStart.toISOString().slice(0, 10)} to ${weekEnd.toISOString().slice(0, 10)}`);

    const result = await Workout.deleteMany({
      userId,
      weekStartDate: { $gte: weekStart, $lt: weekEnd }
    });
    console.log(`Deleted ${result.deletedCount} workout(s) for week ${weekNum}.`);
    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
