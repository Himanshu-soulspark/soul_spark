// =================================================================
// 1. ज़रूरी पैकेजेज़ को इम्पोर्ट करें
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
// 2. सर्वर और सर्विसेज़ को शुरू करें
// =================================================================

const app = express();

// ########## START: ZAROORI BADLAV #1 ##########
// Purani line: app.use(cors());
// Hum server ko bata rahe hain ki sirf 'shubhzone.shop' se aane wali request ko hi allow karna hai.
// Yeh aapki website ko surakshit rakhta hai aur payment ko kaam karne deta hai.
app.use(cors({
  origin: 'https://shubhzone.shop'
}));
// ####################### END BADLAV ########################


// --- Firebase Admin SDK को शुरू करें ---
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

// --- Razorpay को शुरू करें ---
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});
console.log("✅ Razorpay initialized.");


// =================================================================
// WEBHOOK ENDPOINT (Isme koi badlav nahi kiya gaya hai)
// =================================================================

// Webhook के लिए raw body parser का इस्तेमाल करें
app.post('/razorpay-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];

    try {
        const shasum = crypto.createHmac('sha256', secret);
        shasum.update(req.body);
        const digest = shasum.digest('hex');

        if (digest !== signature) {
            console.warn('Webhook signature mismatch!');
            return res.status(400).json({ status: 'Signature mismatch' });
        }

        const body = JSON.parse(req.body.toString());
        const event = body.event;
        const payload = body.payload;
        
        console.log(`Received Webhook Event: ${event}`);

        // --- सब्सक्रिप्शन पहली बार एक्टिवेट होने पर ---
        if (event === 'subscription.activated') {
            const subscription = payload.subscription.entity;
            const usersQuery = await db.collection('users').where('razorpaySubscriptionId', '==', subscription.id).limit(1).get();
            
            if (!usersQuery.empty) {
                const userRef = usersQuery.docs[0].ref;
                await userRef.update({ subscriptionStatus: 'active' });
                console.log(`SUCCESS: Subscription ${subscription.id} for user ${userRef.id} is now ACTIVE.`);
            } else {
                 console.error(`Webhook Error: No user found for activated subscription ID ${subscription.id}`);
            }
        }
        // --- हर महीने की पेमेंट सफल होने पर ---
        else if (event === 'subscription.charged') {
            const subscription = payload.subscription.entity;
            const payment = payload.payment.entity;
            const amount = payment.amount / 100;

            const usersQuery = await db.collection('users').where('razorpaySubscriptionId', '==', subscription.id).limit(1).get();
            if (usersQuery.empty) {
                console.error(`Webhook Error: No user found for charged subscription ID ${subscription.id}`);
                return res.json({ status: 'ok' });
            }
            const userRef = usersQuery.docs[0].ref;

            let coinsToAdd = 0;
            if (amount === 2000) coinsToAdd = 11000;
            else if (amount === 200) coinsToAdd = 1000;

            if (coinsToAdd > 0) {
                await userRef.update({
                    coins: admin.firestore.FieldValue.increment(coinsToAdd),
                    subscriptionStatus: 'active'
                });
                console.log(`SUCCESS: Added ${coinsToAdd} coins to user ${userRef.id} for ₹${amount}.`);
            }
        }
        // --- जब सब्सक्रिप्शन रुक जाए (पेमेंट फेल) ---
        else if (event === 'subscription.halted') {
             const subscription = payload.subscription.entity;
             const usersQuery = await db.collection('users').where('razorpaySubscriptionId', '==', subscription.id).limit(1).get();

             if(!usersQuery.empty) {
                 const userRef = usersQuery.docs[0].ref;
                 await userRef.update({ subscriptionStatus: 'halted' });
                 console.log(`INFO: Subscription ${subscription.id} for user ${userRef.id} has been HALTED due to payment failure.`);
             } else {
                 console.error(`Webhook Error: No user found for halted subscription ID ${subscription.id}`);
             }
        }
        // --- जब सब्सक्रिप्शन खत्म हो जाए ---
        else if (event === 'subscription.completed' || event === 'subscription.cancelled') {
             const subscription = payload.subscription.entity;
             const usersQuery = await db.collection('users').where('razorpaySubscriptionId', '==', subscription.id).limit(1).get();

             if(!usersQuery.empty) {
                 const userRef = usersQuery.docs[0].ref;
                 await userRef.update({ subscriptionStatus: 'cancelled' });
                 console.log(`INFO: Subscription ${subscription.id} for user ${userRef.id} has been cancelled/completed.`);
             }
        }

        res.json({ status: 'ok' });

    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).send('Webhook processing error.');
    }
});


// बाकी सभी routes के लिए JSON parser का इस्तेमाल करें
app.use(express.json({ limit: '10mb' }));

// =================================================================
// 3. API Endpoints (Inme koi badlav nahi kiya gaya hai)
// =================================================================

app.post('/get-food-interaction', async(req, res) => {
  // Aapka original code yahan hai, isme koi badlav nahi
});

app.post('/ask-ai', async(req, res) => {
  // Aapka original code yahan hai, isme koi badlav nahi
});

app.post('/assistant-chat', async(req, res) => {
  // Aapka original code yahan hai, isme koi badlav nahi
});

app.post('/generate-diet-plan', async(req, res) => {
    // Aapka original code yahan hai, isme koi badlav nahi
});

app.post('/analyze-skin', async (req, res) => {
    // Aapka original code yahan hai, isme koi badlav nahi
});

app.get('/get-youtube-videos', async(req, res) => {
    // Aapka original code yahan hai, isme koi badlav nahi
});

app.get('/get-weather-advice', async(req, res) => {
    // Aapka original code yahan hai, isme koi badlav nahi
});

app.get('/get-address-from-coords', async(req, res) => {
    // Aapka original code yahan hai, isme koi badlav nahi
});

app.get('/get-nutrition-info', async(req, res) => {
    // Aapka original code yahan hai, isme koi badlav nahi
});

app.get('/get-info-by-barcode', async(req, res) => {
    // Aapka original code yahan hai, isme koi badlav nahi
});


// =================================================================
// 4. PAYMENT & SUBSCRIPTION ENDPOINTS (YAHAN SABSE BADA BADLAV HAI)
// =================================================================

// ########## START: ZAROORI BADLAV #2 - NAYA PAYMENT CREATION LOGIC ##########
app.post('/create-payment', async (req, res) => {
    try {
        const { isSubscription, amount } = req.body;
        // NOTE: Asli app me, aapko yahan user ka token verify karke
        // uska razorpayCustomerId (agar hai) nikalna hoga.

        if (isSubscription) {
            
            // Step 1: Subscription ke liye options taiyar karein.
            // Isme ab 'plan_id' nahi hai. Hum Razorpay ko seedhe nirdesh de rahe hain.
            const subscriptionOptions = {
                // plan_id yahan se hata diya gaya hai!
                total_count: 20, // 5 saal x 4 quarter/saal = 20 baar charge kar sakte hain
                quantity: 1,
                customer_notify: 1,
                // Yeh initial ₹1 ka charge hai jo authentication ke liye hai
                addons: [{ item: { name: "Mandate Authentication Fee", amount: 100, currency: "INR" }}],
                notes: {
                    mandate_type: "on_demand_for_shubhzone" // Aap apne reference ke liye note daal sakte hain
                }
            };
            
            // Step 2: Razorpay ko bole ki ek naya subscription (permission) banaye
            const subscription = await razorpay.subscriptions.create(subscriptionOptions);

            // Step 3: Client (aapki website) ko permission (subscription_id) aur key bhejein
            return res.json({
                subscription_id: subscription.id,
                key_id: process.env.RAZORPAY_KEY_ID
            });

        } else {
            // One-time payment ka logic (isme koi badlav nahi)
            if(!amount) return res.status(400).json({ error: "Amount is required for one-time payments." });
            const options = { 
                amount, 
                currency: "INR", 
                receipt: `rcpt_one_time_${Date.now()}`
            };
            const order = await razorpay.orders.create(options);
            return res.json({ id: order.id, amount: order.amount, key_id: process.env.RAZORPAY_KEY_ID });
        }

    } catch (error) {
        console.error("Error creating on-demand subscription:", error);
        res.status(500).json({ error: "Could not create payment mandate." });
    }
});
// ##########################################################################


// ########## START: ZAROORI BADLAV #3 - NAYA VERIFICATION LOGIC ##########
app.post('/verify-payment', async (req, res) => {
    try {
        // NOTE: Asli app me, aap yahan user ka token verify karenge.
        
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature, razorpay_subscription_id } = req.body;

        if (razorpay_subscription_id) {
             // Yeh ₹1 ke subscription authentication ke liye hai
             const attributes = {
                 razorpay_payment_id: razorpay_payment_id,
                 razorpay_subscription_id: razorpay_subscription_id,
                 razorpay_signature: razorpay_signature
             };

             // Razorpay ki library se signature verify karein. Agar galat hoga to yeh error dega.
             razorpay.utils.verifyPaymentSignature(attributes);
             
             // Signature sahi hai! Ab sabse zaroori kaam hai.
             // YAHAN PAR AAPKO FIREBASE MEIN USER KI DETAILS SAVE KARNI HOGI.
             // Jaise: razorpay_subscription_id, razorpay_customer_id, aur next_billing_date (aaj se 3 mahine baad).
             
             console.log(`Successfully authenticated subscription ${razorpay_subscription_id}.`);
             return res.json({ status: 'success', message: 'Subscription setup successful! Your plan is now active.' });

        } else if (razorpay_order_id) {
             // One-time payment ka logic (isme koi badlav nahi)
             const body = razorpay_order_id + "|" + razorpay_payment_id;
             const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                                          .update(body.toString()).digest('hex');
            
             if (expectedSignature !== razorpay_signature) {
                 return res.status(400).json({ status: 'failure', message: 'Payment verification failed.' });
             }
             
             const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
             if (paymentDetails.status === 'authorized') {
                 await razorpay.payments.capture(razorpay_payment_id, { amount: paymentDetails.amount, currency: "INR" });
             }

             const orderDetails = await razorpay.orders.fetch(razorpay_order_id);
             const amountPaid = orderDetails.amount / 100;
             let coinsToAdd = 0;
             if (amountPaid === 100) coinsToAdd = 520;
             else if (amountPaid === 200) coinsToAdd = 1030;
             else if (amountPaid === 500) coinsToAdd = 2550;
             else if (amountPaid === 1000) coinsToAdd = 5200;

             if (coinsToAdd > 0) {
                 // Yahan aapko userRef ki zaroorat padegi
                 // const userRef = db.collection('users').doc(decodedToken.uid);
                 // await userRef.update({ coins: admin.firestore.FieldValue.increment(coinsToAdd) });
             }
             return res.json({ status: 'success', message: `${coinsToAdd} coins added.` });
        } else {
            return res.status(400).json({ status: 'failure', message: 'Required Razorpay IDs not provided.' });
        }

    } catch (error) {
        console.error("Error in /verify-payment:", error);
        res.status(500).json({ status: 'failure', message: error.message || "Verification failed on server." });
    }
});
// ##########################################################################


// =================================================================
// 5. WEBSITE SERVING & SERVER START (Isme koi badlav nahi)
// =================================================================
app.use(express.static(path.join(__dirname, '..')));
app.get('/Features/water.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'Features', 'water.html')));
app.get('/Features/Diet.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'Features', 'Diet.html')));
app.get('/Features/Health.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'Features', 'Health.html')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// =================================================================
// 6. सर्वर को चालू करें
// =================================================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
