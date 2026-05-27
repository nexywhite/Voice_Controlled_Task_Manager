import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());

app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  try {
    const transcription = await client.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: "gpt-4o-mini-transcribe",
    });

    fs.unlinkSync(req.file.path);

    res.json({ text: transcription.text });
  } catch (error) {
    console.error("TRANSCRIPTION ERROR:");
    console.error(error);

    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: "Transcription failed",
      details: error.message,
    });
  }
});

app.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});