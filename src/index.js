const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const PayOS = require("@payos/node");
const Payment = require("./models/Payment");

const app = express();
const PORT = process.env.PORT || 3000;
dotenv.config();

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use("/", express.static(__dirname + "/public"));

const payos = new PayOS(
  process.env.PAYOS_CLIENT_ID,
  process.env.PAYOS_API_KEY,
  process.env.PAYOS_CHECKSUM_KEY
);

app.post("/create-payment-link", async (req, res) => {
  const { userId, amount, description } = req.body;

  if (!userId || !amount || !description) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const orderCode = Date.now();
  const paymentData = {
    orderCode,
    amount,
    description,
    cancelUrl: `${process.env.SERVER_URL}/cancel.html`,
    returnUrl: `${process.env.SERVER_URL}/success.html`,
  };

  console.log("Payment Data gửi lên PayOS:", paymentData);

  try {
    const paymentLinkResponse = await payos.createPaymentLink(paymentData);
    console.log("Payment Link Response:", paymentLinkResponse);
    const paymentUrl = paymentLinkResponse.checkoutUrl;

    res.json({ paymentUrl, orderCode });
  } catch (error) {
    console.error("Error creating payment link:", error.message);
    res
      .status(500)
      .json({ error: "Failed to create payment link", details: error.message });
  }
});

app.get("/success", async (req, res) => {
  const { orderCode } = req.query;

  try {
    const payment = new Payment({
      userId: "unknown",
      amount: 0,
      description: "Thanh toán qua PayOS",
      orderCode: Number(orderCode),
      paymentUrl: `https://pay.payos.vn/${orderCode}`,
      status: "SUCCESS",
    });
    await payment.save();

    console.log(`Payment ${orderCode} saved to database`);
    res.redirect("/success.html");
  } catch (error) {
    console.error("Error saving payment:", error.message);
    res.status(500).send("Server error");
  }
});

app.get("/cancel", (req, res) => {
  res.redirect("/cancel.html");
});

app.listen(PORT, () => {
  console.log(`Payment server running on port ${PORT}`);
});
