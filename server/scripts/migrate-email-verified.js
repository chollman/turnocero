/**
 * One-shot migration: marks all existing users as emailVerified=true.
 *
 * Context: when email verification was introduced, we decided to grandfather
 * pre-existing accounts so they don't get locked out. New registrations go
 * through the normal verify-on-signup flow.
 *
 * Run once per environment:
 *   node server/scripts/migrate-email-verified.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

(async () => {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set. Aborting.');
    process.exit(1);
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const result = await User.updateMany(
      { emailVerified: { $ne: true } },
      { $set: { emailVerified: true } }
    );
    console.log(`Matched ${result.matchedCount}, modified ${result.modifiedCount} users.`);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected. Done.');
  }
})();
