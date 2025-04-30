// node/index.js
const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'my-secret-key';

app.use(bodyParser.json());

app.post('/login', (req, res) => {
  const { username } = req.body;
  const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });
  res.json({ token });
});

function verifyToken(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(403).send("No token provided.");

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).send("Unauthorized.");
  }
}

app.post('/chat', verifyToken, async (req, res) => {
  const { message, planType } = req.body;

  try {
    const response = await axios.post(
      'https://d053-34-169-79-250.ngrok-free.app/ai/chat',
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