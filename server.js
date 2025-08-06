import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
const port = process.env.PORT || 3001;

// --- सीक्रेट्स को अलग-अलग फ़ाइलों से लोड करें ---
// (इस हिस्से में कोई बदलाव नहीं किया गया है)
console.log("Server starting up. Attempting to load secrets from separate files...");
let apiKey, razorpayKeyId, razorpayKeySecret;

function readSecretFromFile(fileName) {
    try {
        const filePath = path.join('/etc/secrets', fileName);
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, 'utf8').trim();
        }
        console.warn(`Secret file not found: ${fileName}. Trying environment variables next.`);
        return process.env[fileName] || null;
    } catch (error) {
        console.error(`Error reading secret file ${fileName}:`, error);
        return null;
    }
}

apiKey = readSecretFromFile('dareplay_secrets.json');
razorpayKeyId = readSecretFromFile('RAZORPAY_KEY_ID');
razorpayKeySecret = readSecretFromFile('RAZORPAY_KEY_SECRET');

// जाँचें कि कीज़ लोड हुई हैं या नहीं
console.log(`Google AI Key loaded: ${!!apiKey}`);
console.log(`Razorpay Key ID loaded: ${!!razorpayKeyId}`);
console.log(`Razorpay Key Secret loaded: ${!!razorpayKeySecret}`);

if (!razorpayKeyId || !razorpayKeySecret) {
    console.error("FATAL: One or more required Razorpay keys are missing. Server cannot start.");
    process.exit(1);
}
console.log("All required keys loaded successfully. Initializing services...");

// सेवाओं को शुरू करें (कोई बदलाव नहीं)
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const razorpay = new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret });


// --- सर्वर रूट्स ---

// होम पेज परोसें (कोई बदलाव नहीं)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// फ्रंटएंड को Razorpay Key ID भेजें (कोई बदलाव नहीं)
app.get('/api/get-key', (req, res) => res.json({ keyId: razorpayKeyId }));


// === ⭐ आवश्यक बदलाव सिर्फ़ इस सेक्शन में है ⭐ ===
//
// पहले यह फंक्शन हमेशा 10 रुपये का ऑर्डर बनाता था।
// अब यह फ्रंटएंड से भेजी गई किसी भी राशि (amount) का ऑर्डर बना सकता है।
// यह डेयर (₹10) और लूडो (₹10, ₹25, ₹50 आदि) दोनों के लिए काम करेगा।
//
app.post('/api/create-order', async (req, res) => {
    // फ्रंटएंड से भेजी गई राशि (amount) प्राप्त करें
    const { amount } = req.body;

    // जाँचें कि राशि सही है या नहीं
    if (!amount || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ error: "Invalid or missing amount provided." });
    }

    const options = {
        amount: amount * 100, // Razorpay के लिए राशि को पैसे में बदलें (जैसे ₹10 = 1000 पैसे)
        currency: "INR",
        receipt: `receipt_dare_${Date.now()}` // रसीद आईडी पहले की तरह ही काम करेगी
    };

    try {
        const order = await razorpay.orders.create(options);
        console.log(`Created order ${order.id} for amount ₹${amount}`);
        res.json(order);
    } catch (error) {
        console.error("Error creating Razorpay payment order:", error);
        res.status(500).send("Error creating payment order.");
    }
});


// पेमेंट को वेरिफाई करें और डेयर जेनरेट करें
// (इस फंक्शन में कोई बदलाव नहीं किया गया है। यह पहले की तरह ही काम करेगा जब डेयर के लिए पेमेंट होगा।)
app.post('/api/verify-payment', async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    
    // सिग्नेचर को वेरिफाई करें (बहुत महत्वपूर्ण)
    const expectedSignature = crypto.createHmac('sha256', razorpayKeySecret).update(body.toString()).digest('hex');
    if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ error: "Payment verification failed. Signature mismatch." });
    }

    // अगर AI सर्विस कॉन्फ़िगर नहीं है तो एरर भेजें
    if (!genAI) {
        console.error("AI Service is not configured. Cannot generate dares.");
        return res.status(500).json({ error: "Payment successful, but AI Service is not configured on the server." });
    }

    console.log(`Payment verified for order ${razorpay_order_id}. Generating dares...`);

    // AI से डेयर जेनरेट करें
    try {
        const safetySettings = [/*...सुरक्षा सेटिंग्स यहाँ जोड़ें यदि आवश्यक हो...*/];
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest", safetySettings });
        const prompt = `Generate 5 creative, psychologically challenging dares in Hinglish or Hindi. The output must be a valid JSON array of strings. For example: ["Dare 1", "Dare 2", ...]. Do not include any other text or markdown like \`\`\`json.`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        
        // AI से मिले टेक्स्ट को साफ़ करें और JSON में पार्स करें
        let text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const dares = JSON.parse(text);

        res.json({ success: true, dares });
    } catch (error) {
        console.error("Error generating dares after payment verification:", error);
        res.status(500).json({ success: false, error: "Payment successful, but failed to generate dares. Please contact support." });
    }
});

// सर्वर शुरू करें (कोई बदलाव नहीं)
app.listen(port, () => console.log(`Server is running successfully on port ${port}`));
