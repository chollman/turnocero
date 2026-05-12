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
    isAdmin: {
      type: Boolean,
      default: false,
    },
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    friendRequests: [{
      from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      sentAt: { type: Date, default: Date.now },
    }],
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

// Remove password from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
