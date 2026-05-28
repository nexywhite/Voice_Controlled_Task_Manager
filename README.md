# Voice Task Manager

A real-time AI-powered voice assistant for managing tasks completely through voice interaction.

Users can create, read, update, and delete tasks using natural spoken language without manual CRUD interactions.

---

## Features

- Voice-based task creation
- Voice-based task updates
- Voice-based task deletion with confirmation
- Conversational task reading and agenda summaries
- Context-aware follow-up commands
- Relative time understanding
- Weekly calendar UI
- Real-time Speech-to-Text transcription
- Text-to-Speech assistant responses
- Ambiguous task clarification
- Local task persistence using localStorage

---

## Tech Stack

### Frontend
- React
- Vite
- JavaScript
- MediaRecorder API
- SpeechSynthesis API

### Backend
- Node.js
- Express
- OpenAI API

### AI
- OpenAI Speech-to-Text
- GPT-4o-mini for command understanding

---

## Example Voice Commands

### Create Tasks

- "Create a task for gym tomorrow at 7 AM"
- "Create three tasks for tomorrow morning"

### Read Tasks

- "What is my agenda today?"
- "What are my evening tasks this week?"

### Update Tasks

- "Move the laundry task to 6 PM"
- "Move the second one one hour later"
- "Change the previous one to tomorrow"

### Delete Tasks

- "Delete the LinkedIn task"
- "Delete the first one"

---

## Features Implemented

### Conversational Context

The assistant understands:
- previous one
- first / second / third / last / middle
- relative time changes
- follow-up commands

### Time Understanding

The assistant supports:
- today
- tomorrow
- this week
- next week
- this weekend
- in three days
- morning / afternoon / evening / night

### Reliability Features

- Confirmation before deletion
- Ambiguous task clarification
- Error handling
- Voice interruption handling
- Persistent storage

---

## Installation

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd voice-task-manager
```

### 2. Install dependences

``` bash
npm install
```

### 3. Create .env

Create a .env file in the root directory:
``` env
OPENAI_API_KEY=your_openai_api_key
```

## Running the Project

### Start Frontend

``` bash
npm run dev
```

### Start Backend

``` bash
npm run server
```

Frontend:  http://localhost:5173
Backend:   http://localhost:3001

## Project Structure

```text
voice-task-manager/
├── server/
│   └── index.js
├── src/
│   ├── App.jsx
│   ├── App.css
│   └── main.jsx
├── uploads/
├── .env
├── package.json
└── README.md
```

## Deployment

Recommended deployment platforms:

### Frontend
- Vercel
- Netlify

### Backend
- Render
- Railway

## Limitations

- Uses localStorage instead of a database
- English voice commands only
- No authentication
- Browser microphone permissions required

## Future Improvements

- Real-time streaming transcription
- Better semantic task matching
- Multi-user support
- Database integration
- Recurring tasks
- Calendar drag-and-drop
- Voice activity detection
- Mobile optimization

## AI Usage

ChatGPT v5.5 was used for UI/UX stylizing and documentation review only.

## Author
Sofia Konstantinovskaia
