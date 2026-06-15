const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    table: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Table",
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Respuesta a otro comentario (hilo de 1 nivel, estilo Facebook). null =
    // comentario de nivel superior. Las respuestas a una respuesta se aplanan
    // al comentario raíz en la ruta, así que `parent` siempre apunta a un
    // comentario de nivel superior.
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
      index: true,
    },
    content: {
      type: String,
      required: [true, "Comment content is required"],
      trim: true,
      maxlength: [500, "Comment cannot exceed 500 characters"],
    },
    editedAt: {
      type: Date,
      default: null,
    },
    // Likes del comentario (mismo shape que Compartida.likes): array plano de
    // refs a User. El cliente recibe `likeCount`/`liked` derivados (ver
    // utils/serializeComment.js), nunca este array crudo.
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Comment", commentSchema);
