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

app.use(express.json());
app.use(cors());

app.post("/api/command", async (req, res) => {
  try {
    const { text } = req.body;

    const now = new Date();

    const currentDateTime = now.toLocaleString("sv-SE", {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const today = currentDateTime.split("T")[0];

    console.log("Parsing command:", text);

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are a task manager command parser.

Current datetime is ${currentDateTime}.
User's timezone is ${timezone}.
Today's date is ${today}.

Convert the user's voice command into JSON.

Supported intents:
- create_task
- read_tasks
- update_task
- delete_task
- unknown
- confirm
- cancel
- clarify_selection

For read_tasks:
- Always resolve the requested time range into dateRange.
- dateRange.startDate and dateRange.endDate must be YYYY-MM-DD.
- endDate is inclusive.
- Examples:
  "today" -> startDate today, endDate today
  "tomorrow" -> startDate tomorrow, endDate tomorrow
  "this week" -> Monday to Sunday of current week
  "next week" -> Monday to Sunday of next week
  "in three days" -> that exact date
  "this weekend" -> upcoming Saturday and Sunday
  "today evening" -> same date, plus timeOfDay = "evening"

For update_task:
- target should describe the task to update.
- newDate should contain the new date if mentioned.
- newTime should contain the new time if mentioned.
For update_task:
- If the user asks to move a task earlier/later by a duration, set timeShiftMinutes.
- Earlier means negative minutes.
- Later means positive minutes.
- Example: "move laundry one hour earlier" => "timeShiftMinutes": -60.
- Do not calculate newTime from current time in this case.

For delete_task:
- target should describe the task to delete.
- needsConfirmation should be true.
- Do not delete immediately.

For confirm:
- Use intent "confirm" for answers like "yes", "yeah", "correct", "delete it", "confirm".

For cancel:
- Use intent "cancel" for answers like "no", "cancel", "don't delete it".

Reference resolution:
- If the user refers to "previous one", use:
  reference.type = "last_task"
- If the user refers to a position from the last read task list, use:
  reference.type = "list_position"
  reference.position = 1-based position
- Examples:
  "first one" -> position 1
  "second one" -> position 2
  "third one" -> position 3
  "last one" -> position -1
  "middle one" -> position 0
- If the user names the task directly, use:
  reference.type = "semantic"
  reference.text = task description

If the user answers a clarification question with "first", "second", "third", "last", etc., return intent "clarify_selection" and fill reference.type as "list_position".

Return times ONLY in HH:mm format.
Never include seconds.
Examples:
07:00
19:33
21:05

Return only valid JSON.

Schema:
{
  "intent": "create_task | read_tasks | update_task | delete_task | confirm | cancel | clarify_selection | unknown",
  "tasks": [
    {
        "title": string,
        "date": string | null,
        "time": string | null
    }
  ],
  "reference": {
        "type": "last_task | list_position | semantic | none",
        "position": "number | null",
        "label": "string | null",
        "text": "string | null"
},
  "target": string | null,
  "newDate": string | null,
  "newTime": string | null,
  "timeShiftMinutes": number | null,
  "dateRange": {
    "startDate": "YYYY-MM-DD | null",
    "endDate": "YYYY-MM-DD | null",
    "label": "string | null"
},
  "timeOfDay": "morning | afternoon | evening | night | all | null"
  "needsConfirmation": boolean,
  "response": string
}
          `,
        },
        {
          role: "user",
          content: text,
        },
      ],
      response_format: { type: "json_object" },
    });

    const command = JSON.parse(response.choices[0].message.content);

    if (command.tasks) {
        command.tasks = command.tasks.map((task) => ({
            ...task,
            time: task.time ? task.time.slice(0, 5) : null,
        }));
    }

    if (command.newTime) {
        command.newTime = command.newTime.slice(0, 5);
    }

    console.log("Command parsed successfully");

    res.json(command);
  } catch (error) {
    console.error("COMMAND PARSING ERROR:");
    console.error(error);

    res.status(500).json({
      error: "Command parsing failed",
      details: error.message,
    });
  }
});