const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");

dotenv.config();
const app = express();
app.use(bodyParser.json());

// Simpan API key kamu di file .env
const VALID_API_KEY = process.env.API_KEY || "IQeFNK4E";

// Endpoint Chatbot
app.get("/api/chat", async (req, res) => {
    const userKey = req.query.apikey;
    const text = req.query.text;

    // Cek API Key
    if (userKey !== VALID_API_KEY) {
        return res.status(403).json({ status: false, message: "API Key tidak valid!" });
    }

    // Contoh respons dummy
    res.json({
        status: true,
        creator: "saechii",
        message: `Kamu tanya: ${text}. apa.`
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ API berjalan di http://localhost:${PORT}`));
