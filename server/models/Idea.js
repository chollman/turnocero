const mongoose = require("mongoose");

const IDEA_STATUSES = ["new", "reviewed", "archived"];

const ideaSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 2000,
    },
    fromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    fromEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 200,
      default: null,
    },
    status: {
      type: String,
      enum: IDEA_STATUSES,
      default: "new",
      index: true,
    },
  },
  { timestamps: true },
);

ideaSchema.index({ status: 1, createdAt: -1 });

const Idea = mongoose.model("Idea", ideaSchema);
Idea.STATUSES = IDEA_STATUSES;

module.exports = Idea;
