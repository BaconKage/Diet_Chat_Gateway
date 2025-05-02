// node/index.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');

const app = express();
const PORT = 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'my-secret-key';
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ LOGIN Route (returns JWT token)
app.post('/login', (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: "Username is required" });
  }

  const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });
  res.json({ token });
});

// ✅ Token Middleware
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : authHeader;

  if (!token) return res.status(403).send("No token provided.");

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).send("Unauthorized.");
  }
}

// ✅ CHAT route (single message)
app.post('/chat', verifyToken, async (req, res) => {
  const { message, planType } = req.body;

  try {
    const response = await axios.post(
      process.env.FASTAPI_URL,
      { message, planType },
      { headers: { 'Content-Type': 'application/json' } }
    );

    res.json(response.data);
  } catch (error) {
    console.error("❌ FastAPI Error:", error.response?.data || error.message);
    res.status(500).json(error.response?.data || { error: "Unknown error" });
  }
});

// ✅ CHAT route (batch file upload)
app.post('/chat/file', upload.single('file'), async (req, res) => {
  const token = req.body.token;
  const filePath = req.file.path;
  const results = [];

  const parseCSV = () =>
    new Promise((resolve, reject) => {
      const data = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => data.push(row))
        .on('end', () => resolve(data))
        .on('error', (err) => reject(err));
    });

  try {
    const users = await parseCSV();

    for (const user of users) {
      const { name, age, gender, goal, BMI, diet_type, duration } = user;
      const prompt = `A ${age}-year-old ${diet_type} ${gender} wants to ${goal}. BMI is ${BMI}.`;

      try {
        const response = await axios.post(
          process.env.FASTAPI_URL,
          { message: prompt, planType: duration },
          { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
        );

        results.push({
          name,
          plan: response.data.reply || '⚠️ No reply'
        });
      } catch (error) {
        results.push({
          name,
          plan: `❌ Error for ${name}: ${error.message}`
        });
      }
    }

    fs.unlinkSync(filePath); // clean up temp file
    res.json({ plans: results });

  } catch (err) {
    res.status(500).json({ error: "Failed to process CSV", details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Node.js server running at http://localhost:${PORT}`);
});
