const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  const [, , emailArg, newPassword] = process.argv;

  if (!emailArg || !newPassword) {
    console.error('Usage: node server/scripts/resetUserPassword.js <email> <newPassword>');
    process.exit(1);
  }

  const email = String(emailArg).trim().toLowerCase();

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/soulbox';

  await mongoose.connect(uri);

  const user = await User.findOne({ email });
  if (!user) {
    console.error(`User not found for email: ${email}`);
    process.exit(1);
  }

  user.password = newPassword;
  await user.save();

  console.log(`Password reset for ${email}`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Error resetting password:', err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});

