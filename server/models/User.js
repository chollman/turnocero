const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [254, 'Email cannot exceed 254 characters'],
      match: [/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      validate: {
        validator: (v) => /^(?=.*[A-Z])(?=.*\d).+$/.test(v),
        message: 'Password must contain at least one uppercase letter and one number',
      },
    },
    avatar: {
      type: String,
      default: '',
    },
    displayName: {
      type: String,
      default: '',
      maxlength: [60, 'Display name cannot exceed 60 characters'],
      trim: true,
    },
    nombre: {
      type: String,
      default: '',
      maxlength: [50, 'Nombre cannot exceed 50 characters'],
      trim: true,
    },
    apellido: {
      type: String,
      default: '',
      maxlength: [50, 'Apellido cannot exceed 50 characters'],
      trim: true,
    },
    direccion: {
      texto: { type: String, default: '' },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    telegram: {
      type: String,
      default: '',
      maxlength: [50, 'Telegram username cannot exceed 50 characters'],
      trim: true,
    },
    celular: {
      type: String,
      default: '',
      maxlength: [30, 'Phone number cannot exceed 30 characters'],
      trim: true,
    },
    bggUsername: {
      type: String,
      default: '',
      maxlength: [50, 'BGG username cannot exceed 50 characters'],
      trim: true,
    },
    bggCredentials: {
      encryptedPassword: { type: String, default: '' },
      connectedAt: { type: Date, default: null },
      lastValidatedAt: { type: Date, default: null },
      invalid: { type: Boolean, default: false },
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    isBanned: {
      type: Boolean,
      default: false,
    },
    bannedAt: {
      type: Date,
      default: null,
    },
    bannedReason: {
      type: String,
      default: '',
      maxlength: [500, 'Ban reason cannot exceed 500 characters'],
      trim: true,
    },
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    friendRequests: [{
      from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      sentAt: { type: Date, default: Date.now },
    }],
    emailVerified: { type: Boolean, default: false },
    emailVerificationCodeHash: { type: String, default: null, select: false },
    emailVerificationExpiresAt: { type: Date, default: null, select: false },
    emailVerificationAttempts: { type: Number, default: 0, select: false },
    passwordResetTokenHash: { type: String, default: null, select: false },
    passwordResetExpiresAt: { type: Date, default: null, select: false },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password and BGG credentials from JSON output; expose derived flags
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  const creds = obj.bggCredentials;
  obj.bggConnected = !!(creds && creds.encryptedPassword);
  obj.bggInvalid = !!(creds && creds.invalid);
  obj.bggConnectedAt = creds?.connectedAt || null;
  delete obj.bggCredentials;
  delete obj.emailVerificationCodeHash;
  delete obj.emailVerificationExpiresAt;
  delete obj.emailVerificationAttempts;
  delete obj.passwordResetTokenHash;
  delete obj.passwordResetExpiresAt;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
