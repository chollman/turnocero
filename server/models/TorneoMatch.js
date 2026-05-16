const mongoose = require('mongoose');

const torneoMatchSchema = new mongoose.Schema(
  {
    torneo:     { type: mongoose.Schema.Types.ObjectId, ref: 'Torneo', required: true, index: true },
    round:      { type: Number, required: true, min: 1 },
    matchIndex: { type: Number, required: true, min: 0 },

    playerA: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    playerB: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    nextMatch:   { type: mongoose.Schema.Types.ObjectId, ref: 'TorneoMatch', default: null },
    isUpperSlot: { type: Boolean, default: true },

    winner:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isDraw:   { type: Boolean, default: false },
    status:   { type: String, enum: ['pending', 'completed', 'bye'], default: 'pending' },
    playedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

torneoMatchSchema.index({ torneo: 1, round: 1, matchIndex: 1 });

module.exports = mongoose.model('TorneoMatch', torneoMatchSchema);
