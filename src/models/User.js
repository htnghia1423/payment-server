// models/User.js
const { Schema, model } = require("mongoose");

const UserSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true },
    userType: {
      type: String,
      enum: ["free", "premium"],
      default: "free",
    },
    premiumExpiration: { type: Date, required: false },
  },
  { timestamps: true }
);

UserSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = model("User", UserSchema);
