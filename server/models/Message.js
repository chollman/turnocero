const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    table: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Table",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: { type: String, required: true, maxlength: 1000, trim: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Message", messageSchema);
