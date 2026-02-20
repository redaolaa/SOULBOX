// Create a trial user with the same data as the source user (e.g. Ola).
// Keeps the source user unchanged. New user gets a copy of all exercises, workouts, and tri-sets.
//
// Usage:
//   node scripts/copyUserDataToTrial.js
//   node scripts/copyUserDataToTrial.js trial trial@example.com Trial123!
//   node scripts/copyUserDataToTrial.js <newUsername> <newEmail> <newPassword>
// Source user defaults to username "ola". To use another source:
//   node scripts/copyUserDataToTrial.js trial trial@example.com Trial123! ola

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Exercise = require('../models/Exercise');
const Workout = require('../models/Workout');
const TriSet = require('../models/TriSet');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/soulbox';

async function connect() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');
}

function mapId(id, idMap) {
  if (!id) return null;
  const str = id.toString();
  return idMap.get(str) || id;
}

async function main() {
  const newUsername = process.argv[2] || 'trial';
  const newEmail = process.argv[3] || 'trial@example.com';
  const newPassword = process.argv[4] || 'Trial123!';
  const sourceUsername = process.argv[5] || null;

  try {
    await connect();

    const sourceUser = sourceUsername
      ? await User.findOne({ username: sourceUsername }) || await User.findOne({ email: sourceUsername })
      : await User.findOne({ username: /^ola/i }) || await User.findOne();
    if (!sourceUser) {
      throw new Error(`Source user not found. Use 5th arg: username or email (e.g. ola or Olaf).`);
    }
    if (await User.findOne({ $or: [{ username: newUsername }, { email: newEmail.toLowerCase() }] })) {
      throw new Error(`User already exists with username "${newUsername}" or email "${newEmail}". Choose different credentials.`);
    }

    const sourceId = sourceUser._id;
    console.log(`Source user: ${sourceUser.username} (${sourceUser.email})\n`);

    const newUser = await User.create({
      username: newUsername,
      email: newEmail.trim().toLowerCase(),
      password: newPassword,
      name: `Trial (copy of ${sourceUser.name || sourceUser.username})`
    });
    const newId = newUser._id;
    console.log(`Created user: ${newUser.username} (${newUser.email})\n`);

    const idMap = new Map();

    const exercises = await Exercise.collection.find({ userId: sourceId }).toArray();
    for (const ex of exercises) {
      const { _id, userId, ...rest } = ex;
      const inserted = await Exercise.collection.insertOne({
        ...rest,
        userId: newId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      idMap.set(_id.toString(), inserted.insertedId);
    }
    console.log(`Copied ${exercises.length} exercise(s).`);

    const workouts = await Workout.find({ userId: sourceId }).lean();
    for (const w of workouts) {
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
    console.log(`Copied ${workouts.length} workout(s).`);

    const triSets = await TriSet.find({ userId: sourceId }).lean();
    for (const ts of triSets) {
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
    console.log(`Copied ${triSets.length} tri-set(s).`);

    console.log('\nDone. Trial user can log in with:');
    console.log(`  Email: ${newUser.email}`);
    console.log(`  Password: ${newPassword}`);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
