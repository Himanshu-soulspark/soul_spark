import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
const port = process.env.PORT || 3001;

// --- सीक्रेट्स लोड करें ---
let apiKey, razorpayKeyId, razorpayKeySecret;
try {
    const secretFile = fs.readFileSync('/etc/secrets/dareplay_secrets.json', 'utf8');
    const secrets = JSON.parse(secretFile);
    apiKey = secrets.API_KEY;
    razorpayKeyId = secrets.RAZORPAY_KEY_ID;
    razorpayKeySecret = secrets.RAZORPAY_KEY_SECRET;
} catch (err) {
    console.error("Could not read or parse secret file:", err);
}

// यह जांचना कि कीज़ लोड हुई हैं या नहीं
if (!razorpayKeyId || !razorpayKeySecret) {
    console.error("Razorpay keys are not loaded. Server cannot start.");
    process.exit(1); // अगर कीज़ नहीं हैं तो सर्वर बंद कर दें
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const razorpay = new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret });

// --- मुख्य वेब पेज को सर्व करें ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- नया API 3: फ्रंटएंड को सुरक्षित रूप से की आईडी दें ---
app.get('/api/get-key', (req, res) => {
    res.json({ keyId: razorpayKeyId });
});

// --- API 1: Razorpay ऑर्डर बनाएँ ---
app.post('/api/create-order', async (req, res) => {
    const options = {
        amount: 10 * 100,
        currency: "INR",
        receipt: `receipt_dare_${Date.now()}`
    };
    try {
        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (error) {
        console.error("Razorpay order creation failed:", error);
        res.status(500).send("Error creating payment order.");
    }
});

// --- API 2: भुगतान की पुष्टि करें और डेयर जनरेट करें ---
app.post('/api/verify-payment', async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto.createHmac('sha256', razorpayKeySecret).update(body.toString()).digest('hex');
    
    if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ error: "Payment verification failed. Invalid signature." });
    }

    if (!genAI) return res.status(500).json({ error: "AI Service is not configured." });

    try {
        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        ];
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest", safetySettings });
        const prompt = `Generate 5 creative, psychologically challenging dares for a social media app in Hinglish. These dares should feel dangerous and push boundaries like the 'Blue Whale' challenge but MUST BE 100% SAFE...`; // प्रॉम्प्ट वही है
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const dares = JSON.parse(text);
        res.json({ success: true, dares });
    } catch (error) {
        console.error("AI Generation Error after payment:", error);
        res.status(500).json({ error: "Payment successful, but failed to generate dares." });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
