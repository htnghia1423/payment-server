const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const PayOS = require("@payos/node");
const Payment = require("./models/Payment");
const User = require("./models/User");
const moment = require("moment-timezone");

const app = express();
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
    cancelUrl: `${process.env.SERVER_URL}/cancel`,
    returnUrl: `${process.env.SERVER_URL}/success.html`,
  };

  console.log("Payment Data gửi lên PayOS:", paymentData);

  try {
    const paymentLinkResponse = await payos.createPaymentLink(paymentData);
    console.log("Payment Link Response:", paymentLinkResponse);
    const paymentUrl = paymentLinkResponse.checkoutUrl;

    const payment = new Payment({
      userId,
      amount,
      description,
      orderCode,
      paymentUrl,
      status: "PENDING",
    });
    await payment.save();
    console.log(`Payment ${orderCode} created with PENDING status`);

    res.json({ paymentUrl, orderCode });
  } catch (error) {
    console.error("Error creating payment link:", error.message);
    res
      .status(500)
      .json({ error: "Failed to create payment link", details: error.message });
  }
});

app.get("/success", (req, res) => {
  res.redirect("/success.html");
});

app.get("/cancel", async (req, res) => {
  const { orderCode, status, cancel } = req.query;

  console.log("Cancel query params:", req.query);

  if (orderCode && cancel === "true" && status === "CANCELLED") {
    try {
      const payment = await Payment.findOneAndUpdate(
        { orderCode: Number(orderCode), status: "PENDING" },
        { status: "CANCELLED" },
        { new: true }
      );
      if (payment) {
        console.log(`Payment ${orderCode} updated to CANCELLED`);
      } else {
        console.log(`Payment ${orderCode} not found or already updated`);
      }
    } catch (error) {
      console.error("Error updating payment to CANCELLED:", error.message);
    }
  } else {
    console.log("Invalid cancel request or missing params");
  }

  res.redirect("/cancel.html");
});

app.post("/webhook", async (req, res) => {
  const webhookData = req.body;
  console.log("Webhook received:", webhookData);

  try {
    const verifiedData = payos.verifyPaymentWebhookData(webhookData);
    console.log("Verified Webhook Data:", verifiedData);

    if (
      verifiedData.description === "VQRIO123" ||
      verifiedData.orderCode === 123
    ) {
      console.log("This is a test webhook from PayOS, skipping processing");
      return res.status(200).json({ success: true });
    }

    const orderCode = verifiedData.orderCode;
    const paymentCode = verifiedData.code;

    let status;
    switch (paymentCode) {
      case "00":
        status = "SUCCESS";
        break;
      default:
        status = "FAILED";
        console.log("Unhandled payment code:", paymentCode);
    }

    const payment = await Payment.findOneAndUpdate(
      { orderCode: Number(orderCode) },
      { status, transactionId: verifiedData.reference || null },
      { new: true }
    );

    if (!payment) {
      console.error(`Payment ${orderCode} not found`);
      return res.status(404).json({ error: "Payment not found" });
    }

    console.log(`Payment ${orderCode} updated to ${status}`);

    if (status === "SUCCESS") {
      try {
        const expirationDate = moment()
          .tz("Asia/Ho_Chi_Minh")
          .add(1, "months")
          .toDate();

        const user = await User.findOneAndUpdate(
          { userId: payment.userId },
          {
            userType: "premium",
            premiumExpiration: expirationDate,
          },
          { new: true, upsert: true }
        );
        console.log(
          `User ${payment.userId} updated to premium, expires on ${moment(
            expirationDate
          )
            .tz("Asia/Ho_Chi_Minh")
            .format("YYYY-MM-DD HH:mm:ss z")}`
        );
      } catch (error) {
        console.error("Error updating user to premium:", error.message);
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error processing webhook:", error.message);
    res
      .status(400)
      .json({ error: "Invalid webhook data", details: error.message });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Payment server running on port ${process.env.PORT}`);
});
