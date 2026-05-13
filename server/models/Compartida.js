const mongoose = require('mongoose');

const juntadaSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      trim: true,
      maxlength: [100, 'El título no puede superar 100 caracteres'],
      default: '',
    },
    body: {
      type: String,
      trim: true,
      maxlength: [2000, 'El texto no puede superar 2000 caracteres'],
      default: '',
    },
    images: [
      {
        url:       { type: String, required: true },
        publicId:  { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    linkedTable: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Table',
      default: null,
    },
    privacy: {
      type: String,
      enum: ['public', 'friends', 'private'],
      default: 'public',
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Juntada', juntadaSchema);
