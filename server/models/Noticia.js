const mongoose = require("mongoose");
const communityScoped = require("./plugins/communityScoped");

const noticiaSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, maxlength: 200 },
    body: { type: String, trim: true, maxlength: 2000 },
    link: { type: String, trim: true, maxlength: 500 },
    linkLabel: { type: String, trim: true, maxlength: 80 },
    image: {
      url: { type: String },
      publicId: { type: String },
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

// Scoping por comunidad: campo `community` + índice { community, createdAt }.
noticiaSchema.plugin(communityScoped, { indexes: [{ createdAt: -1 }] });

module.exports = mongoose.model("Noticia", noticiaSchema);
