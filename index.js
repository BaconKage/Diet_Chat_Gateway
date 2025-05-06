require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
const FASTAPI_URL = process.env.FASTAPI_URL || 'https://diet-chat-bot.onrender.com/ai/chat';
const upload = multer({ dest: 'uploads/' });

// ✅ MongoDB Setup
mongoose.connect(process.env.CONNECTION_STRING, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

const userSchema = new mongoose.Schema({
  name: String,
  age: Number,
  gender: String,
  goal: String,
  BMI: Number,
  diet_type: String,
  duration: String,
  plan: String
});

const UserPlan = mongoose.model("UserPlan", userSchema);

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ /chat/fromdb/:username → Generate from MongoDB
app.post('/chat/fromdb/:username', async (req, res) => {
  const username = req.params.username;

  try {
    const user = await UserPlan.findOne({ name: username, plan: { $exists: true, $ne: "" } });
    if (!user) return res.status(404).json({ error: "No plan found." });

    res.json({ reply: user.plan });
  } catch (error) {
    console.error("❌ Error in /chat/fromdb:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Health check
app.get('/', (req, res) => {
  res.send("✅ Diet Chat Gateway with MongoDB is running.");
});

// ✅ Debug: List all users
app.get('/debug/all-users', async (req, res) => {
  try {
    const users = await UserPlan.find({});
    res.json({ count: users.length, users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Debug: Seed one user (no duplicates)
app.get('/debug/seed', async (req, res) => {
  try {
    const existing = await UserPlan.findOne({ name: "Riya Kapoor" });
    if (existing) return res.json({ message: "User already exists", user: existing });

    const user = new UserPlan({
      name: "Riya Kapoor",
      age: 27,
      gender: "female",
      goal: "gain muscle",
      BMI: 21.4,
      diet_type: "vegetarian",
      duration: "month",
      plan: "Sample plan for Riya Kapoor."
    });

    await user.save();
    res.json({ message: "✅ Sample user added", user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Debug: Seed multiple sample users
app.get('/debug/seed-many', async (req, res) => {
  try {
    const samples = [
      { name: "Aman Verma", age: 30, gender: "male", goal: "lose weight", BMI: 27.8, diet_type: "vegan", duration: "week", plan: "Plan for Aman Verma." },
      { name: "Neha Sharma", age: 22, gender: "female", goal: "maintain weight", BMI: 20.1, diet_type: "non-vegetarian", duration: "month", plan: "Plan for Neha Sharma." },
      { name: "Kunal Rao", age: 35, gender: "male", goal: "gain muscle", BMI: 24.9, diet_type: "vegetarian", duration: "week", plan: "Plan for Kunal Rao." }
    ];

    for (const s of samples) {
      await UserPlan.updateOne(
        { name: s.name },
        { $set: s },
        { upsert: true }
      );
    }

    res.json({ message: "✅ Multiple users seeded." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
