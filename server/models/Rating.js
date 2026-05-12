const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema(
  {
    table: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Table',
      required: true,
    },
    rater: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    score: {
      type: Number,
      min: [1, 'La puntuación mínima es 1'],
      max: [5, 'La puntuación máxima es 5'],
      required: true,
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [300, 'El comentario no puede superar los 300 caracteres'],
      default: '',
    },
  },
  { timestamps: true }
);

ratingSchema.index({ table: 1, rater: 1 }, { unique: true });

module.exports = mongoose.model('Rating', ratingSchema);
