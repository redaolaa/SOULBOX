const mongoose = require('mongoose');

const workoutSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  dayOfWeek: {
    type: String,
    enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    required: true
  },
  dayType: {
    type: String,
    enum: ['Kickboxing', 'Boxing', 'Technique', 'Conditioning'],
    required: true
  },
  filter: {
    type: String,
    enum: ['Upper Body', 'Lower Body', 'Mixed/Full Body', 'Full Body', 'Cardio', 'Abs'],
    required: true
  },
  weekStartDate: {
    type: Date,
    required: true
  },
  station1: {
    phase1: [{
      exerciseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exercise'
      },
      name: String
    }],
    phase2: [{
      exerciseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exercise'
      },
      name: String
    }]
  },
  station2: [{
    exerciseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exercise'
    },
    name: String
  }],
  station3: [{
    exerciseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exercise'
    },
    name: String
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Workout', workoutSchema);
