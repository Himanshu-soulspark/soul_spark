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

// --- Firebase Admin SDK को शुरू करें (कोई बदलाव नहीं) ---
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
  console.error("\nSOLUTION: Please check your 'FIREBASE_SERVICE_ACCOUNT' environment variable in Render.\n");
  process.exit(1);
}
const db = admin.firestore();

// --- Razorpay को शुरू करें (कोई बदलाव नहीं) ---
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});
console.log("✅ Razorpay initialized.");


// =================================================================
// WEBHOOK ENDPOINT (कोई बदलाव नहीं)
// =================================================================
app.post('/razorpay-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    try {
        const shasum = crypto.createHmac('sha256', secret);
        shasum.update(req.body);
        const digest = shasum.digest('hex');
        if (digest === req.headers['x-razorpay-signature']) {
            console.log('Webhook verified:', req.body);
        } else {
            console.warn('Webhook signature mismatch!');
        }
    } catch (error) {
        console.error("Error in webhook processing:", error);
    }
    res.json({ status: 'ok' });
});


// =================================================================
// PAYMENT & SUBSCRIPTION ENDPOINTS (यहाँ ज़रूरी बदलाव है)
// =================================================================

// ########## START: ZAROORI BADLAV - "Payment Failed" ERROR KO FIX KARNE KE LIYE ##########
// यह फंक्शन अब Plan ID के बिना, सीधे एक ऑर्डर बनाएगा जिसमें भविष्य के पेमेंट की अनुमति होगी।
app.post('/create-payment', async (req, res) => {
    try {
        const orderOptions = {
            amount: 300, // पहली बार कटने वाली राशि: ₹3 (300 पैसे)
            currency: "INR",
            receipt: `rcpt_${Date.now()}`,
            payment_capture: 1,
            
            // --- यही असली और सही तरीका है ---
            // हम ऑर्डर के अंदर ही भविष्य के पेमेंट की शर्तें बता रहे हैं
            method: {
                upi: {
                    recurring: true,
                    // customer_id: 'cust_xxxxxxxxxxxx', // अगर आप कस्टमर बनाते हैं
                    max_amount: 99900, // भविष्य में अधिकतम ₹999 कट सकते हैं
                    frequency: 'as_presented' // जब मर्ज़ी तब
                }
            }
        };

        const order = await razorpay.orders.create(orderOptions);

        // पेमेंट करने के लिए हमें Order ID और Key ID की ज़रूरत होगी
        return res.json({
            order_id: order.id,
            key_id: process.env.RAZORPAY_KEY_ID
        });

    } catch (error) {
        console.error("Error creating order with mandate:", error);
        const errorMessage = error.error ? error.error.description : "Could not create payment mandate.";
        res.status(500).json({ error: errorMessage });
    }
});
// ####################################################################################


// Verify Payment फंक्शन को अब Order ID के साथ काम करने के लिए थोड़ा बदलना होगा
app.post('/verify-payment', async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

        const generated_signature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest('hex');

        if (generated_signature === razorpay_signature) {
            console.log(`Payment verified successfully for order: ${razorpay_order_id}`);
            
            // जब यह पेमेंट सफल होता है, Razorpay अपने आप एक सब्सक्रिप्शन बना देता है।
            // हमें उस सब्सक्रिप्शन ID को निकालना होगा ताकि हम भविष्य में चार्ज कर सकें।
            const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
            const subscriptionId = paymentDetails.subscription_id;

            if (!subscriptionId) {
                throw new Error("Subscription ID not found in payment details. Mandate may have failed.");
            }

            console.log(`Associated Subscription ID for future charging: ${subscriptionId}`);

            res.json({ 
                status: 'success', 
                message: 'Payment verified successfully!',
                subscriptionId: subscriptionId // हम यह ID वापस भेज रहे हैं ताकि इसे Firebase में सेव किया जा सके
            });
        } else {
            console.error('Payment verification failed. Signature mismatch.');
            res.status(400).json({ status: 'error', error: 'Payment verification failed' });
        }
    } catch (error) {
        console.error("Error in /verify-payment:", error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});


// Admin Panel से चार्ज करने वाला फंक्शन (इसमें कोई बदलाव नहीं)
// यह अभी भी subscription_id पर ही काम करेगा, जो हमें ऊपर verify-payment से मिल जाएगी
app.post('/charge-recurring-payment', async (req, res) => {
    try {
        const { subscription_id, amount } = req.body;
        
        if (!subscription_id || !amount || amount <= 0) {
            return res.status(400).json({ status: 'error', error: 'Subscription ID and a valid Amount are required.' });
        }

        const amount_in_paise = amount * 100;
        console.log(`ADMIN PANEL REQUEST: Charging ₹${amount} on subscription ${subscription_id}`);
        
        const invoice = await razorpay.invoices.create({
            type: "invoice",
            subscription_id: subscription_id,
            amount: amount_in_paise,
            currency: "INR",
            description: `Manual charge from Admin Panel for ₹${amount}`
        });

        if (invoice && (invoice.status === 'issued' || invoice.status === 'paid')) {
            console.log(`ADMIN CHARGE SUCCESS: Invoice created successfully. ID: ${invoice.id}`);
            res.json({ 
                status: 'success', 
                message: `Successfully initiated charge of ₹${amount}! Invoice ID: ${invoice.id}`,
                paymentId: invoice.payment_id || 'Pending'
            });
        } else {
             throw new Error("Failed to create an invoice for charging.");
        }

    } catch (error) {
        console.error("Error in /charge-recurring-payment:", error);
        const errorMessage = error.error ? error.error.description : (error.message || "Failed to process the charge.");
        res.status(500).json({ status: 'error', error: errorMessage });
    }
});



// =================================================================
// BAAKI KE SARE API ENDPOINTS (कोई बदलाव नहीं)
// =================================================================
// ... (आपके AI, YouTube, Weather, आदि वाले सारे functions यहाँ अपरिवर्तित रहेंगे) ...


// =================================================================
// 5. WEBSITE SERVING & SERVER START (कोई बदलाव नहीं)
// =================================================================
app.use(express.static(path.join(__dirname, '..')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'admin.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
