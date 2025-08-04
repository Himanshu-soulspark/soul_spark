import express from 'express';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Modules में __dirname को सेट करने के लिए
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// --- मुख्य वेब पेज (index.html) को सर्व करें ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- API एंडपॉइंट: डेयर जनरेट करने के लिए ---
app.get('/api/generate-dares', async (req, res) => {
    if (!genAI) {
        return res.status(500).json({ error: "AI Service is not configured on the server." });
    }
    
    try {
        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        ];

        // *** अंतिम बदलाव: सबसे नए मॉडल का उपयोग ***
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest", safetySettings });
        
        const prompt = `Generate 5 creative dares for a social media app in Hinglish. The dares must be safe and must not encourage self-harm, violence, illegal activities, or bullying. Provide the output ONLY as a valid JSON array of 5 strings.
        The structure must be:
        1. One very easy and simple dare.
        2. One dare about helping someone (a person, animal, or community).
        3. Three very hard, challenging, but safe dares.
        Do not include any other text or markdown like \`\`\`json. Just the raw JSON array.
        Example: ["Pani puri eating challenge karo", "Ek street dog ko khana khilao", "Crowded market mein flash mob organize karo", "Apne 10 dosto ke sath ek social cause ke liye tree plantation drive karo", "Ek din ke liye bina smartphone ke raho"]`;

        const result = await model.generateContent(prompt);
        const response = await result.response;

        if (!response || !response.text) {
             throw new Error("AI response was blocked or empty due to safety filters.");
        }

        let text = response.text();
        text = text.replace(/```json/g, '').replace(/```g, '').trim();
        const dares = JSON.parse(text);

        if (!Array.isArray(dares) || dares.length !== 5) {
            throw new Error("AI did not return 5 dares in the correct JSON format.");
        }

        res.json({ dares });

    } catch (error) {
        console.error("AI Generation Error:", error.message);
        res.status(500).json({ error: `Failed to generate dares from AI. Details: ${error.message}` });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
