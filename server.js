const express = require('express');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const Razorpay = require('razorpay');

const app = express();
const port = process.env.PORT || 3001;

// --- Render Secret File से API की लोड करें ---
let apiKey;
try {
    const secretFilePath = '/etc/secrets/dareplay_secrets.json';
    if (fs.existsSync(secretFilePath)) {
        const secretFile = fs.readFileSync(secretFilePath, 'utf8');
        const secrets = JSON.parse(secretFile);
        apiKey = secrets.API_KEY;
    } else {
        console.warn("Secret file not found. Running in development mode without AI.");
    }
} catch (err) {
    console.error("Could not read or parse secret file:", err);
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// --- Razorpay Instance बनाएं ---
// यह सुनिश्चित करें कि आपने Render के Environment में RAZORPAY_KEY_ID और RAZORPAY_KEY_SECRET सेट किया है
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// --- मुख्य वेब पेज (index.html) को सर्व करें ---
// __dirname अब सीधे काम करेगा
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- API एंडपॉइंट: Razorpay ऑर्डर बनाने के लिए ---
app.get('/api/create-order', async (req, res) => {
    const options = {
        amount: 10 * 100, // 10 रुपये
        currency: "INR",
        receipt: `receipt_order_${new Date().getTime()}`,
    };

    try {
        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (error) {
        console.error("Razorpay Order Creation Error:", error);
        res.status(500).json({ error: "Could not create payment order." });
    }
});


// --- API एंडपॉइंट: डेयर जनरेट करने के लिए ---
app.get('/api/generate-dares', async (req, res) => {
    if (!genAI) {
        return res.status(500).json({ error: "AI Service is not configured on the server." });
    }
    
    try {
        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        ];

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest", safetySettings });
        
        const prompt = `Create a 5-step "Psychological Adventure" for a dare app in Hinglish. The dares must feel risky and thrilling but be absolutely SAFE. They must NOT involve suicide, self-harm, harm to others, illegal acts, bullying, or violating anyone's privacy. The goal is to create a memorable experience that pushes boundaries. Provide the output ONLY as a valid JSON array of 5 unique strings.

        Use the following thrilling and diverse categories:
        1.  **Social Fear Challenge:** A public act that is harmless but requires courage. (Example: "Kisi busy mall ke food court mein, table par khade hokar 30 second tak apna favourite gaana gao.")
        2.  **Emotional Risk Challenge:** A dare involving a close friend or partner that is playful and strengthens the bond. (Example: "Apni girlfriend/boyfriend ko ek handwritten love letter likho aur use unke saamne padh kar sunao, aur unka reaction record karo.")
        3.  **Night Exploration Challenge:** A dare to explore a place at night, with extreme emphasis on safety. (Example: "Raat mein apne sheher ke sabse famous aur SAFE jagah par jao jaha log aate jaate ho, aur waha 10 minute tak bas shaanti se baith kar aas paas ki awazo ko suno. Anubhav share karo.")
        4.  **Fear Confrontation Challenge:** A dare to directly confront a common personal fear. (Example: "Agar tumhe ऊंचाई se dar lagta hai, toh kisi building ke sabse upar wali safe balcony/terrace par jao aur 5 minute tak neeche dekho. Apne dar par kaabu paane ki koshish karo.")
        5.  **Master Social Challenge:** A large-scale, positive social interaction that seems very hard. (Example: "Ek din ke liye 'Digital Detox' karo (no social media, no messaging apps) aur us din kam se kam 5 anjaan logo se (jaise shopkeepers, strangers in a park) 2 minute se jyada baat karo unki life ke baare mein.")

        Do not include any other text or markdown like \`\`\`json. Just the raw JSON array. Make the dares unique and creative every time.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;

        if (!response || !response.text) {
             throw new Error("AI response was blocked or empty due to safety filters.");
        }

        let text = response.text().replace(/```json/g, '').replace(/```g, '').trim();
        const dares = JSON.parse(text);

        if (!Array.isArray(dares) || dares.length !== 5) {
            throw new Error("AI did not return dares in the correct JSON format.");
        }

        res.json({ dares });

    } catch (error) {
        console.error("AI Generation Error:", error.message);
        res.status(500).json({ error: `AI Error: ${error.message}` });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
