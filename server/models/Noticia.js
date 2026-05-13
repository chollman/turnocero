const mongoose = require('mongoose');

const noticiaSchema = new mongoose.Schema(
  {
    title:  { type: String, trim: true, maxlength: 200 },
    body:   { type: String, trim: true, maxlength: 2000 },
    link:   { type: String, trim: true, maxlength: 500 },
    image: {
      url:      { type: String, required: true },
      publicId: { type: String, required: true },
    },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Noticia', noticiaSchema);
