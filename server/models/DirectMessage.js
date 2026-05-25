const mongoose = require("mongoose");

const directMessageSchema = new mongoose.Schema(
  {
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    content: { type: String, required: true, maxlength: 1000, trim: true },
    readByRecipient: { type: Boolean, default: false },
  },
  { timestamps: true },
);

directMessageSchema.index({ from: 1, to: 1, createdAt: 1 });
directMessageSchema.index({ to: 1, from: 1, createdAt: 1 });

module.exports = mongoose.model("DirectMessage", directMessageSchema);
