const mongoose = require('mongoose');

// Linked set of 3 Station 1 exercises for Technique days (Monday/Saturday).
// All 3 must be generated together; used for Phase 1 or Phase 2.
const triSetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  dayType: {
    type: String,
    enum: ['Technique'],
    required: true,
    default: 'Technique'
  },
  focus: {
    type: String,
    enum: ['Mixed', 'Lower'],
    required: true
  },
  name: {
    type: String,
    default: ''
  },
  // Concept/theme that ties the 3 exercises (e.g. "SLIP L progression", "1/SLIP L series")
  concept: {
    type: String,
    default: ''
  },
  // Phase 1: grid order A (0), B (1), C (2)
  exerciseIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exercise',
    required: true
  }],
  // Phase 2: for Monday, another 3 exercises in order (optional for Saturday)
  phase2ExerciseIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exercise'
  }],
  lastUsed: Date
}, {
  timestamps: true
});

triSetSchema.path('exerciseIds').validate(function (val) {
  return val && val.length === 3;
}, 'TriSet must have exactly 3 exercises in Phase 1');

triSetSchema.path('phase2ExerciseIds').validate(function (val) {
  if (!val || val.length === 0) return true;
  return val.length === 3;
}, 'Phase 2 must have exactly 3 exercises or be empty');

module.exports = mongoose.model('TriSet', triSetSchema);
