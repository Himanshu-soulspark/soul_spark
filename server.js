const express = require('express'); // Express framework को इम्पोर्ट करें
const app = express(); // एक Express एप्लिकेशन इंस्टेंस बनाएँ
const port = process.env.PORT || 3000; // पोर्ट को परिभाषित करें। Render जैसे होस्टिंग प्लेटफॉर्म पर, process.env.PORT का उपयोग किया जाता है।

// यह middleware Express को बताता है कि वर्तमान डायरेक्टरी (जहाँ server.js स्थित है)
// में मौजूद सभी फ़ाइलें स्टैटिक एसेट्स (जैसे HTML, CSS, JavaScript, इमेज) हैं
// और उन्हें सीधे वेब ब्राउज़र को परोसा जा सकता है।
// आपकी index.html, image फ़ोल्डर, और अन्य .jpg फ़ाइलें सीधे इसी डायरेक्टरी में हैं,
// इसलिए __dirname का उपयोग करना सही है।
app.use(express.static(__dirname));

// रूट URL ('/') के लिए एक GET रिक्वेस्ट हैंडलर परिभाषित करें।
// जब कोई उपयोगकर्ता आपके एप्लिकेशन के मुख्य URL (जैसे your-app-name.onrender.com) पर जाता है,
// तो यह कोड चलेगा।
app.get('/', (req, res) => {
  // यह क्लाइंट को आपकी index.html फ़ाइल भेजता है।
  // __dirname + '/index.html' आपकी index.html फ़ाइल का पूरा पाथ बनाता है।
  res.sendFile(__dirname + '/index.html');
});

// सर्वर को परिभाषित पोर्ट पर सुनना शुरू करें।
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
