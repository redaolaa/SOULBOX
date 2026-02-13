const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  station: {
    type: Number,
    required: true,
    enum: [1, 2, 3]
  },
  focus: {
    type: String,
    enum: ['Upper', 'Lower', 'Mixed', 'Full Body'],
    required: true
  },
  dayType: {
    type: String,
    enum: ['Boxing', 'Kickboxing', 'Technique', 'Conditioning'],
    required: true
  },
  isStatic: {
    type: Boolean,
    default: false
  },
  staticCondition: {
    type: String,
    enum: ['kickboxing-station3-b', 'boxing-station3-b', 'technique-station3', 'conditioning-station3', null],
    default: null
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastUsed: Date,
  usageHistory: [{
    date: Date,
    workoutId: mongoose.Schema.Types.ObjectId
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Exercise', exerciseSchema);