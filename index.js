// node/index.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'my-secret-key';

app.use(cors());
app.use(bodyParser.json());

// ✅ LOGIN Route (no token check here!)
app.post('/login', (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: "Username is required" });
  }

  const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });
  res.json({ token });  // This is what your frontend expects
});

// ✅ Token Middleware with Bearer support
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

// ✅ Chat route
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

app.listen(PORT, () => {
  console.log(`✅ Node.js server running at http://localhost:${PORT}`);
});
