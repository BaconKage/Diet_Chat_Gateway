import dotenv from 'dotenv';
import express from 'express';
import axios from 'axios';
import cors from 'cors';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const FASTAPI_URL = process.env.FASTAPI_URL || 'https://diet-chat-bot.onrender.com/ai/chat';

// ✅ MongoDB Setup
mongoose.connect(process.env.CONNECTION_STRING, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

const userSchema = new mongoose.Schema({
  name: String,
  phone: String,
  goal: String,
  gender: String,
  image: String,
  username: String,
  bio: String,
  gym: String,
  package: String,
  Face_Recognition: String,
  user_type: String,
  user_club: String
});

const User = mongoose.model("User", userSchema);
const mealPlans = mongoose.connection.collection("mealplans");

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ /chat/user/:phone → Generate and save diet plan
app.post('/chat/user/:phone', async (req, res) => {
  const phone = req.params.phone;
  const trainerId = process.env.TRAINER_ID; // 🔒 Trainer ObjectId as env var

  try {
    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ error: "User not found." });

    const { name, goal, gender, bio, _id } = user;
    const prompt = `Client: ${name}\nGender: ${gender}\nGoal: ${goal}\nBio: ${bio || 'N/A'}`;

    const formattedRequest = `Create a weekly diet plan strictly using only foods from the MongoDB foods collection for this profile. Do not hallucinate or use items outside the database. Focus on meals, hydration, supplements, and one motivational tip.\n\n${prompt}`;

    const response = await axios.post(
      FASTAPI_URL,
      { message: formattedRequest, planType: 'week' },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const reply = response.data.reply?.trim();
    if (!reply) return res.status(500).json({ error: "Empty response from AI." });

    // Save to mealPlans
    await mealPlans.insertOne({
      for_date: new Date(),
      created_by: new ObjectId(trainerId),
      created_for: new ObjectId(_id),
      mealPlan: [{ day: 'weekly', plan: reply }],
      created_at: new Date(),
      updated_at: new Date()
    });

    res.json({ name, reply, saved: true });
  } catch (error) {
    console.error("❌ Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Health check
app.get('/', (req, res) => {
  res.send("✅ Diet Chat Gateway for Registered MyGym Users is running.");
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
