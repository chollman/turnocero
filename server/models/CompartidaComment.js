const mongoose = require('mongoose');

const juntadaCommentSchema = new mongoose.Schema(
  {
    juntada: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Juntada',
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: [true, 'El comentario no puede estar vacío'],
      trim: true,
      maxlength: [500, 'El comentario no puede superar 500 caracteres'],
    },
    editedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('JuntadaComment', juntadaCommentSchema);
