// Script to import exercises from the week's workout examples
// Run with: node scripts/importExercises.js

require('dotenv').config();
const mongoose = require('mongoose');
const Exercise = require('../models/Exercise');
const User = require('../models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/soulbox')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Exercise data extracted from the week's workouts
const exercises = [
  // ========== SUNDAY - KICKBOXING (Upper Body) ==========
  // Station 1 - Phase 1
  { name: 'SHOULDER PRESS', station: 1, focus: 'Upper', dayType: 'Kickboxing' },
  { name: 'FRONTAL RAISES', station: 1, focus: 'Upper', dayType: 'Kickboxing' },
  { name: 'INFINITY CIRCLES', station: 1, focus: 'Upper', dayType: 'Kickboxing' },
  // Station 1 - Phase 2
  { name: 'LATERAL RAISES', station: 1, focus: 'Upper', dayType: 'Kickboxing' },
  { name: 'REVERSE FLYS', station: 1, focus: 'Upper', dayType: 'Kickboxing' },
  { name: 'WEIGHTED 1,2S', station: 1, focus: 'Upper', dayType: 'Kickboxing' },
  // Station 2
  { name: '1,2, 2X KNEES', station: 2, focus: 'Mixed', dayType: 'Kickboxing' },
  { name: '1,2, L LOW KICK,3, FAKE LOW KICK, SPINNING BACK FIST', station: 2, focus: 'Mixed', dayType: 'Kickboxing' },
  { name: 'LOW,BODY,HIGH KICK', station: 2, focus: 'Mixed', dayType: 'Kickboxing' },
  // Station 3
  { name: 'PARTNER - ATT/DEF BODY KICK/THROW, SPINNING BACK FIST', station: 3, focus: 'Mixed', dayType: 'Kickboxing' },
  { name: 'PARTNER - LIGHT SPARRING', station: 3, focus: 'Mixed', dayType: 'Kickboxing', isStatic: true, staticCondition: 'kickboxing-station3-b' },
  { name: 'SIDEKICK TECHNIQUE', station: 3, focus: 'Mixed', dayType: 'Kickboxing' },

  // ========== MONDAY - TECHNIQUE (Mixed/Full Body) ==========
  // Station 1 - Phase 1
  { name: 'R BK LUNGES TO TWISTING KNEE DRIVE', station: 1, focus: 'Lower', dayType: 'Technique' },
  { name: 'L BK LUNGES TO TWISTING KNEE DRIVE', station: 1, focus: 'Lower', dayType: 'Technique' },
  { name: 'FLUTTER KICKS', station: 1, focus: 'Lower', dayType: 'Technique' },
  { name: 'OVERHEAD HOLD SQUATS', station: 1, focus: 'Lower', dayType: 'Technique' },
  // Station 1 - Phase 2
  { name: 'CURTSY LUNGES', station: 1, focus: 'Lower', dayType: 'Technique' },
  { name: 'DUMBBELL TAP TO OVERHEAD', station: 1, focus: 'Lower', dayType: 'Technique' },
  // Station 2
  { name: 'JAB, STRT, L BODY, L HOOK, R HOOK, JAB (1-2-3B-3-4-1)', station: 2, focus: 'Mixed', dayType: 'Technique' },
  { name: 'JAB, STRT, SWITCH, R BODY, STRT, JAB (1-2-SWITCH-3B-2-1)', station: 2, focus: 'Mixed', dayType: 'Technique' },
  { name: '30 SECS 1,2,3,4 / 30 SECS 3,4,3B,4B / 30 SECS 1,2,2X R ELBOWS', station: 2, focus: 'Mixed', dayType: 'Technique' },
  // Station 3
  { name: 'PARTNER - ATT/DEF JAB/SWITCH', station: 3, focus: 'Mixed', dayType: 'Technique' },
  { name: 'PARTNER - ATT/DEF JAB/SWITCH,SWITCH,3B', station: 3, focus: 'Mixed', dayType: 'Technique' },
  { name: 'PARTNER - ATT/DEF JAB/SWITCH,SWITCH,3B,2,1', station: 3, focus: 'Mixed', dayType: 'Technique' },

  // ========== TUESDAY - BOXING (Upper Body) ==========
  // Station 1 - Phase 1
  { name: 'R BK LUNGES TO TWISTING KNEE DRIVE', station: 1, focus: 'Upper', dayType: 'Boxing' },
  { name: 'L BK LUNGES TO TWISTING KNEE DRIVE', station: 1, focus: 'Upper', dayType: 'Boxing' },
  { name: 'FLUTTER KICKS', station: 1, focus: 'Upper', dayType: 'Boxing' },
  // Station 1 - Phase 2
  { name: 'OVERHEAD HOLD SQUATS', station: 1, focus: 'Upper', dayType: 'Boxing' },
  { name: 'CURTSY LUNGES', station: 1, focus: 'Upper', dayType: 'Boxing' },
  { name: 'DUMBBELL TAP TO OVERHEAD', station: 1, focus: 'Upper', dayType: 'Boxing' },
  // Station 2
  { name: 'JAB, STRT, R BODY, L HOOK, R HOOK (1-2-4B-3-4)', station: 2, focus: 'Mixed', dayType: 'Boxing' },
  { name: 'JAB, STRT, STEP BK/IN/JAB, STRT, L HOOK (1-2-STEP BK/IN/1-2-3)', station: 2, focus: 'Mixed', dayType: 'Boxing' },
  { name: '1,2,DUCK,1,2', station: 2, focus: 'Mixed', dayType: 'Boxing' },
  // Station 3
  { name: 'PARTNER - MIRRORING (1,2,3,4)', station: 3, focus: 'Mixed', dayType: 'Boxing' },
  { name: 'PARTNER - LIGHT SPARRING', station: 3, focus: 'Mixed', dayType: 'Boxing', isStatic: true, staticCondition: 'boxing-station3-b' },
  { name: 'PARTNER - LEG TAGS', station: 3, focus: 'Mixed', dayType: 'Boxing' },

  // ========== WEDNESDAY - CONDITIONING (Lower Body) ==========
  // Station 1 - Phase 1
  { name: 'THRUSTERS', station: 1, focus: 'Lower', dayType: 'Conditioning' },
  { name: 'DEVIL PRESS', station: 1, focus: 'Lower', dayType: 'Conditioning' },
  { name: 'BURPEES', station: 1, focus: 'Lower', dayType: 'Conditioning' },
  // Station 1 - Phase 2 (empty in example, but we'll add some)
  { name: 'JUMP SQUATS', station: 1, focus: 'Lower', dayType: 'Conditioning' },
  { name: 'MOUNTAIN CLIMBERS', station: 1, focus: 'Lower', dayType: 'Conditioning' },
  { name: 'BOX JUMPS', station: 1, focus: 'Lower', dayType: 'Conditioning' },
  // Station 2
  { name: '5X 1,2,1,1,4', station: 2, focus: 'Mixed', dayType: 'Conditioning' },
  { name: '5X CROSS SWITCHES', station: 2, focus: 'Mixed', dayType: 'Conditioning' },
  { name: '5X 1,2,2,3', station: 2, focus: 'Mixed', dayType: 'Conditioning' },
  { name: '5X STEP IN/OUT', station: 2, focus: 'Mixed', dayType: 'Conditioning' },
  { name: '5X R BACKWARD LUNGE TO STRT', station: 2, focus: 'Mixed', dayType: 'Conditioning' },
  { name: '5X L BACKWARD LUNGE TO JAB', station: 2, focus: 'Mixed', dayType: 'Conditioning' },
  // Station 3
  { name: 'PARTNER - ATT/DEF JAB/PARRY,1,2,3', station: 3, focus: 'Mixed', dayType: 'Conditioning' },
  { name: 'PARTNER - ATT/DEF JAB/SLIP R/1B,4,3', station: 3, focus: 'Mixed', dayType: 'Conditioning' },
  { name: 'PARTNER - ATT/DEF JAB/LEAN BK,2,1,4', station: 3, focus: 'Mixed', dayType: 'Conditioning' },

  // ========== THURSDAY - KICKBOXING (Mixed/Full Body) ==========
  // Station 1 - Phase 1
  { name: 'HAMMER CURLS', station: 1, focus: 'Mixed', dayType: 'Kickboxing' },
  { name: 'NARROW GRIP PRESS', station: 1, focus: 'Mixed', dayType: 'Kickboxing' },
  { name: 'WINDSCREEN WIPERS', station: 1, focus: 'Mixed', dayType: 'Kickboxing' },
  // Station 1 - Phase 2
  { name: 'GOOD MORNINGS', station: 1, focus: 'Mixed', dayType: 'Kickboxing' },
  { name: 'KICKBACKS', station: 1, focus: 'Mixed', dayType: 'Kickboxing' },
  { name: 'HIGH KNEES', station: 1, focus: 'Mixed', dayType: 'Kickboxing' },
  // Station 2
  { name: '1,2,3, R BODY KICK, 3,4', station: 2, focus: 'Mixed', dayType: 'Kickboxing' },
  { name: '1,2, STEP BK, FLYING KNEE', station: 2, focus: 'Mixed', dayType: 'Kickboxing' },
  { name: 'FREESTYLE', station: 2, focus: 'Mixed', dayType: 'Kickboxing' },
  // Station 3
  { name: 'PARTNER - ATT/DEF 1,2,SWITCH KICK, SWITCH,4B /BLK', station: 3, focus: 'Mixed', dayType: 'Kickboxing' },
  { name: 'PARTNER - LIGHT SPARRING', station: 3, focus: 'Mixed', dayType: 'Kickboxing', isStatic: true, staticCondition: 'kickboxing-station3-b' },
  { name: 'ROUND KICK TECHNIQUE', station: 3, focus: 'Mixed', dayType: 'Kickboxing' },

  // ========== SATURDAY - TECHNIQUE (Lower Body) ==========
  // Station 1 - Phase 1
  { name: 'R BK LUNGES TO TWISTING KNEE DRIVE', station: 1, focus: 'Lower', dayType: 'Technique' },
  { name: 'L BK LUNGES TO TWISTING KNEE DRIVE', station: 1, focus: 'Lower', dayType: 'Technique' },
  { name: 'FLUTTER KICKS', station: 1, focus: 'Lower', dayType: 'Technique' },
  { name: 'OVERHEAD HOLD SQUATS', station: 1, focus: 'Lower', dayType: 'Technique' },
  // Station 1 - Phase 2
  { name: 'CURTSY LUNGES', station: 1, focus: 'Lower', dayType: 'Technique' },
  { name: 'DUMBBELL TAP TO OVERHEAD', station: 1, focus: 'Lower', dayType: 'Technique' },
  // Station 2
  { name: 'JAB, STRT, JAB BODY, L HK, L BODY, STR', station: 2, focus: 'Mixed', dayType: 'Technique' },
  { name: 'JAB,STRT,LHK, WV L,L / HK,STRT,SLIPR,RHK', station: 2, focus: 'Mixed', dayType: 'Technique' },
  { name: '10 SECS WEAVE L-3 -2 - SLIP R-4 / 10 SECS WEAVE / 10 SECS FOOTWORK', station: 2, focus: 'Mixed', dayType: 'Technique' },
  // Station 3
  { name: 'PARTNER - ATT/DEF JAB/PARRY,1,2,3', station: 3, focus: 'Mixed', dayType: 'Technique' },
  { name: 'PARTNER - ATT/DEF JAB/SLIP R/1B,4.3', station: 3, focus: 'Mixed', dayType: 'Technique' },
  { name: 'PARTNER - ATT/DEF JAB/LEAN BK,2,1,4', station: 3, focus: 'Mixed', dayType: 'Technique' },
];

async function importExercises(userId) {
  try {
    console.log(`Importing ${exercises.length} exercises for user ${userId}...`);
    
    let imported = 0;
    let skipped = 0;

    for (const exerciseData of exercises) {
      // Check if exercise already exists for this user
      const existing = await Exercise.findOne({
        userId,
        name: exerciseData.name,
        station: exerciseData.station,
        dayType: exerciseData.dayType
      });

      if (existing) {
        console.log(`Skipping duplicate: ${exerciseData.name}`);
        skipped++;
        continue;
      }

      const exercise = new Exercise({
        ...exerciseData,
        userId,
        isStatic: exerciseData.isStatic || false,
        staticCondition: exerciseData.staticCondition || null
      });

      await exercise.save();
      imported++;
      console.log(`✓ Imported: ${exerciseData.name}`);
    }

    console.log(`\n✅ Import complete!`);
    console.log(`   Imported: ${imported}`);
    console.log(`   Skipped (duplicates): ${skipped}`);
    console.log(`   Total: ${exercises.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error importing exercises:', error);
    process.exit(1);
  }
}

// Get user ID from command line or use first user
async function main() {
  const userId = process.argv[2];
  
  if (!userId) {
    // Find first user
    const user = await User.findOne();
    if (!user) {
      console.error('No users found. Please register first.');
      process.exit(1);
    }
    console.log(`Using user: ${user.username} (${user._id})`);
    await importExercises(user._id);
  } else {
    await importExercises(userId);
  }
}

main();
