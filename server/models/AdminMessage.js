const mongoose = require("mongoose");

const adminMessageSchema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, maxlength: 2000, trim: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("AdminMessage", adminMessageSchema);
