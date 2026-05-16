const mongoose = require('mongoose');

const torneoGroupSchema = new mongoose.Schema(
  {
    torneo:      { type: mongoose.Schema.Types.ObjectId, ref: 'Torneo', required: true, index: true },
    phase:       { type: Number, required: true, min: 1 },
    tableNumber: { type: Number, required: true, min: 1 },
    players:         [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    advancedPlayers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    status:      { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

torneoGroupSchema.index({ torneo: 1, phase: 1, tableNumber: 1 });

module.exports = mongoose.model('TorneoGroup', torneoGroupSchema);
