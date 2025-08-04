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
app.use(express.json()); // JSON बॉडी को पार्स करने के लिए
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

// --- सेवाएँ शुरू करें ---
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
const razorpay = new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret });

// --- मुख्य वेब पेज को सर्व करें ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- API 1: Razorpay ऑर्डर बनाएँ ---
app.post('/api/create-order', async (req, res) => {
    const options = {
        amount: 10 * 100, // 10 रुपये (राशि पैसे में)
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
    
    // भुगतान की पुष्टि
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto.createHmac('sha256', razorpayKeySecret).update(body.toString()).digest('hex');
    
    if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ error: "Payment verification failed. Invalid signature." });
    }

    // पुष्टि सफल! अब AI से डेयर जनरेट करें
    if (!genAI) {
        return res.status(500).json({ error: "AI Service is not configured." });
    }

    try {
        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        ];
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest", safetySettings });
        
        const prompt = `Generate 5 creative, psychologically challenging dares for a social media app in Hinglish. These dares should feel dangerous and push boundaries like the 'Blue Whale' challenge but MUST BE 100% SAFE. They must not encourage self-harm, harm to others, illegal activities, bullying, harassment, or anything hateful. The goal is to help users overcome their fears and step out of their comfort zone in a safe way.
        The structure must be:
        1. One 'Looks Easy, But Is Hard' dare.
        2. One dare about a significant act of kindness or community help.
        3. Three 'Fear-Facing' dares that are mentally tough but physically safe.
        Provide the output ONLY as a valid JSON array of 5 strings. Do not include any other text or markdown like \`\`\`json. Just the raw JSON array.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const dares = JSON.parse(text);

        res.json({ success: true, dares });

    } catch (error) {
        console.error("AI Generation Error after payment:", error);
        res.status(500).json({ error: "Payment was successful, but failed to generate dares." });
    }
});


app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
