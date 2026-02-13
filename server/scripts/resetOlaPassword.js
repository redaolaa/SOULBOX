// One-off script to reset Ola's password.
// Usage:
//   node scripts/resetOlaPassword.js
//
// This will set a new password for the user with email:
//   ola-reda@hotmail.co.uk

require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../models/User');

const NEW_PASSWORD = 'Soulbox123!'; // temporary password – change after first login

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/soulbox');
    console.log('Connected to MongoDB');

    const email = 'ola-reda@hotmail.co.uk';
    const user = await User.findOne({ email });

    if (!user) {
      console.error('No user found with email', email);
      process.exit(1);
    }

    user.password = NEW_PASSWORD; // will be hashed by pre-save hook
    await user.save();

    console.log(`Password reset for ${email}`);
    console.log(`Temporary password is: ${NEW_PASSWORD}`);
    console.log('Please log in and change it as soon as possible.');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error resetting password:', err);
    process.exit(1);
  }
}

main();

