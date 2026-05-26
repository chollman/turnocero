const mongoose = require("mongoose");

const compartidaCommentSchema = new mongoose.Schema(
  {
    compartida: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Compartida",
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: [true, "El comentario no puede estar vacío"],
      trim: true,
      maxlength: [500, "El comentario no puede superar 500 caracteres"],
    },
    editedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("CompartidaComment", compartidaCommentSchema);
