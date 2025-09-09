// =================================================================
// 1. ज़रूरी पैकेजेज़ को इम्पोर्ट करें (कोई बदलाव नहीं)
// =================================================================
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Razorpay = require('razorpay');
const path = require('path');
const axios = require('axios');
const { google } = require('googleapis');
const FormData = require('form-data');
const crypto = require('crypto');

// =================================================================
// 2. सर्वर और सर्विसेज़ को शुरू करें (कोई बदलाव नहीं)
// =================================================================
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- Firebase Admin SDK (कोई बदलाव नहीं) ---
try {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set!');
  }
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log("✅ Firebase Admin SDK initialized successfully.");
} catch (error) {
  console.error("\n\n❌❌❌ FATAL ERROR: Firebase Admin SDK could not be initialized. ❌❌❌");
  console.error("REASON:", error.message);
  process.exit(1);
}
const db = admin.firestore();

// --- Razorpay (कोई बदलाव नहीं) ---
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});
console.log("✅ Razorpay initialized.");

// =================================================================
// WEBHOOK ENDPOINT (कोई बदलाव नहीं)
// =================================================================
app.post('/razorpay-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    res.json({ status: 'ok' });
});

// =================================================================
// PAYMENT & SUBSCRIPTION ENDPOINTS (यहाँ ज़रूरी बदलाव है)
// =================================================================

// ########## START: ZAROORI BADLAV - "Customer ID" ERROR KO FIX KARNE KE LIYE ##########
app.post('/create-payment', async (req, res) => {
    try {
        // Step 1: Frontend (index.html) se user ki details lena
        const { name, email, phone } = req.body;
        if (!name || !email || !phone) {
            return res.status(400).json({ error: "Name, email, and phone are required." });
        }

        // Step 2: In details se Razorpay par ek Customer banana
        console.log(`Creating customer for: ${email}`);
        const customer = await razorpay.customers.create({
            name: name,
            email: email,
            contact: phone,
        });
        console.log(`Customer created with ID: ${customer.id}`);

        // Step 3: Ab us Customer ID ka istemal karke Order banana
        const orderOptions = {
            amount: 300, // ₹3
            currency: "INR",
            receipt: `rcpt_${Date.now()}`,
            customer_id: customer.id, // <<<<===== YAHI SABSE ZAROORI BADLAV HAI
            payment_capture: 1,
            token: {
                "recurring": true,
                "max_amount": 99900,
                "frequency": "as_presented"
            }
        };

        const order = await razorpay.orders.create(orderOptions);
        console.log(`Order created for customer ${customer.id} with Order ID: ${order.id}`);

        return res.json({
            order_id: order.id,
            key_id: process.env.RAZORPAY_KEY_ID
        });

    } catch (error) {
        console.error("Error during payment creation:", error.error || error);
        const errorMessage = error.error ? error.error.description : "Could not create payment.";
        res.status(500).json({ error: errorMessage });
    }
});
// ####################################################################################

// Verify Payment फंक्शन (इसमें कोई बदलाव नहीं)
app.post('/verify-payment', async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
        const generated_signature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest('hex');
        if (generated_signature === razorpay_signature) {
            console.log(`Payment verified for order: ${razorpay_order_id}`);
            const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
            const subscriptionId = paymentDetails.subscription_id;
            if (!subscriptionId) throw new Error("Subscription ID not found.");
            console.log(`Associated Subscription ID: ${subscriptionId}`);
            res.json({ status: 'success', message: 'Payment verified!', subscriptionId: subscriptionId });
        } else {
            res.status(400).json({ status: 'error', error: 'Payment verification failed' });
        }
    } catch (error) {
        console.error("Error in /verify-payment:", error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

// Admin Panel से चार्ज करने वाला फंक्शन (इसमें कोई बदलाव नहीं)
app.post('/charge-recurring-payment', async (req, res) => {
    try {
        const { subscription_id, amount } = req.body;
        if (!subscription_id || !amount || amount <= 0) {
            return res.status(400).json({ error: 'Subscription ID and Amount are required.' });
        }
        const amount_in_paise = amount * 100;
        console.log(`ADMIN REQUEST: Charging ₹${amount} on subscription ${subscription_id}`);
        const invoice = await razorpay.invoices.create({
            type: "invoice",
            subscription_id: subscription_id,
            amount: amount_in_paise,
            currency: "INR",
            description: `Manual charge from Admin Panel for ₹${amount}`
        });
        if (invoice && (invoice.status === 'issued' || invoice.status === 'paid')) {
            console.log(`ADMIN CHARGE SUCCESS: Invoice ID: ${invoice.id}`);
            res.json({ status: 'success', message: `Charge initiated for ₹${amount}!`, paymentId: invoice.payment_id || 'Pending' });
        } else {
             throw new Error("Failed to create invoice.");
        }
    } catch (error) {
        console.error("Error in /charge-recurring-payment:", error);
        const errorMessage = error.error ? error.error.description : "Failed to process charge.";
        res.status(500).json({ status: 'error', error: errorMessage });
    }
});

// =================================================================
// BAAKI KE SARE API ENDPOINTS (कोई बदलाव नहीं)
// =================================================================
// ... (AI, YouTube, etc. functions) ...

// =================================================================
// 5. WEBSITE SERVING & SERVER START (कोई बदलाव नहीं)
// =================================================================
app.use(express.static(path.join(__dirname, '..')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '..', 'admin.html')));
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server is running on port ${PORT}`));
