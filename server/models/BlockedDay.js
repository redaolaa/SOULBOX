const mongoose = require('mongoose');

const blockedDaySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  weekStartDate: {
    type: Date,
    required: true
  },
  dayOfWeek: {
    type: String,
    enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Saturday'],
    required: true
  }
}, { timestamps: true });

blockedDaySchema.index({ userId: 1, weekStartDate: 1, dayOfWeek: 1 }, { unique: true });

module.exports = mongoose.model('BlockedDay', blockedDaySchema);
