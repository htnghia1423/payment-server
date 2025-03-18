const { Schema, model } = require("mongoose");

const PaymentSchema = new Schema({
  userId: { type: String, required: true },
  amount: { type: Number, required: true },
  description: { type: String, required: true },
  orderCode: { type: Number, required: true, unique: true },
  paymentUrl: { type: String, required: false },
  status: {
    type: String,
    enum: ["PENDING", "SUCCESS", "CANCELLED", "FAILED"],
    default: "PENDING",
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  transactionId: { type: String, required: false },
});

PaymentSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = model("Payment", PaymentSchema);
