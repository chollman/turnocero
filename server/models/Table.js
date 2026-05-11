const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema(
  {
    boardGame: {
      type: String,
      required: [true, 'Board game name is required'],
      trim: true,
      maxlength: [100, 'Game name cannot exceed 100 characters'],
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
    },
    maxPlayers: {
      type: Number,
      required: [true, 'Max players quantity is required'],
      min: [1, 'Must allow at least 1 additional player'],
      max: [20, 'Cannot exceed 20 additional players'],
    },
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    players: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    location: {
      type: String,
      trim: true,
      maxlength: [200, 'Location cannot exceed 200 characters'],
      default: '',
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    status: {
      type: String,
      enum: ['open', 'full', 'cancelled'],
      default: 'open',
    },
    privacy: {
      type: String,
      enum: ['public', 'private'],
      default: 'public',
    },
    pendingRequests: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    reactions: [
      {
        user:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        emoji: { type: String, enum: ['❤️', '🎲', '🔥', '👍', '😄'], required: true },
      },
    ],
  },
  { timestamps: true }
);

// Virtual: total seats (host + maxPlayers)
tableSchema.virtual('totalPlayers').get(function () {
  return this.maxPlayers + 1;
});

// Virtual: available seats
tableSchema.virtual('availableSeats').get(function () {
  return this.maxPlayers - this.players.length;
});

// Auto-update status based on player count
tableSchema.pre('save', function (next) {
  if (this.players.length >= this.maxPlayers) {
    this.status = 'full';
  } else if (this.status === 'full') {
    this.status = 'open';
  }
  next();
});

module.exports = mongoose.model('Table', tableSchema);
