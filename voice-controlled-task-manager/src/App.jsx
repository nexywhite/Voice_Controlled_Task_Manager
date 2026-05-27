import { useState } from "react";
import "./App.css";

const hours = Array.from({ length: 14 }, (_, index) => index + 7);

function getWeekDays(startDate) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    return date;
  });
}

function speak(text) {
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  window.speechSynthesis.speak(utterance);
}

function App() {
  const [status, setStatus] = useState("Idle");
  const [lastCommand, setLastCommand] = useState("");
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    today.setDate(today.getDate() + diff);
    return today;
  });

  const weekDays = getWeekDays(weekStart);

  function changeWeek(direction) {
    const newDate = new Date(weekStart);
    newDate.setDate(weekStart.getDate() + direction * 7);
    setWeekStart(newDate);
  }

  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);

  async function startListening() {
    try {
      window.speechSynthesis.cancel();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.onstart = () => {
        setStatus("Recording...");
        setLastCommand("");
      };

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        setStatus("Transcribing...");

        const audioBlob = new Blob(chunks, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("audio", audioBlob, "command.webm");

        try {
          const response = await fetch("http://localhost:3001/api/transcribe", {
            method: "POST",
            body: formData,
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Transcription failed");
          }

          setLastCommand(data.text);
          setStatus("Command received");
          speak(`I heard: ${data.text}`);
        } catch (error) {
          console.error(error);
          setStatus("Transcription error");
          speak("Sorry, I could not transcribe that.");
        }

        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setAudioChunks(chunks);
    } catch (error) {
      console.error(error);
      setStatus("Microphone error");
      speak("I could not access the microphone.");
    }
  }

  function stopListening() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    setStatus("Stopping...");
  }
}

  return (
    <main className="app">
      <section className="card">
        <h1>Voice Task Manager</h1>
        <p className="subtitle">Manage your tasks using only voice commands.</p>

        <div className="assistant-panel">
          <p>
            Status: <strong>{status}</strong>
          </p>

          {status === "Recording..." ? (
            <button onClick={stopListening}>Stop Recording</button>
          ) : (
            <button onClick={startListening}>Start Voice Assistant</button>
          )}

          {lastCommand && (
            <p className="last-command">
              Last command: <strong>{lastCommand}</strong>
            </p>
          )}
        </div>

        <section className="calendar-section">
          <div className="calendar-header">
            <button onClick={() => changeWeek(-1)}>← Previous Week</button>
            <h2>Weekly Calendar</h2>
            <button onClick={() => changeWeek(1)}>Next Week →</button>
          </div>

          <div className="calendar-grid">
            <div className="time-header"></div>

            {weekDays.map((day) => (
              <div className="day-header" key={day.toISOString()}>
                <strong>
                  {day.toLocaleDateString("en-US", { weekday: "short" })}
                </strong>
                <span>
                  {day.toLocaleDateString("en-US", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </div>
            ))}

            {hours.map((hour) => (
              <div className="calendar-row" key={hour}>
                <div className="time-cell">{hour}:00</div>

                {weekDays.map((day) => (
                  <div
                    className="calendar-cell"
                    key={`${day.toISOString()}-${hour}`}
                  ></div>
                ))}
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

export default App;