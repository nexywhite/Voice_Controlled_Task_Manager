import { useEffect, useState } from "react";
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

function getDateString(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().split("T")[0];
}

function matchesTimeOfDay(time, timeOfDay) {
  if (!time) return false;

  const hour = Number(time.split(":")[0]);

  if (timeOfDay === "morning") return hour >= 5 && hour < 12;
  if (timeOfDay === "afternoon") return hour >= 12 && hour < 17;
  if (timeOfDay === "evening") return hour >= 17 && hour < 22;
  if (timeOfDay === "night") return hour >= 22 || hour < 5;

  return true;
}

function getTasksSummary(tasks, commandData) {
  let filteredTasks = tasks;

  const startDate = commandData.dateRange?.startDate;
  const endDate = commandData.dateRange?.endDate;

  if (startDate && endDate) {
    filteredTasks = filteredTasks.filter(
      (task) => task.date >= startDate && task.date <= endDate
    );
  }

  if (commandData.timeOfDay && commandData.timeOfDay !== "all") {
    filteredTasks = filteredTasks.filter((task) =>
      matchesTimeOfDay(task.time, commandData.timeOfDay)
    );
  }

  if (filteredTasks.length === 0) {
    return {
      summary: "You do not have any matching tasks.",
      sortedTasks: [],
    };
  }

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.time.localeCompare(b.time);
  });

  const taskText = sortedTasks
    .map((task) => `${task.title} on ${task.date} at ${task.time}`)
    .join(", ");

  return {
    summary: `You have ${sortedTasks.length} task${
      sortedTasks.length > 1 ? "s" : ""
    }: ${taskText}.`,
    sortedTasks,
  };
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
  const [parsedCommand, setParsedCommand] = useState(null);

  const weekDays = getWeekDays(weekStart);

  function changeWeek(direction) {
    const newDate = new Date(weekStart);
    newDate.setDate(weekStart.getDate() + direction * 7);
    setWeekStart(newDate);
  }

  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);

  const [tasks, setTasks] = useState(() => {
    const savedTasks = localStorage.getItem("voice-task-manager-tasks");
    return savedTasks ? JSON.parse(savedTasks) : [];
  });

  const [pendingDeleteTask, setPendingDeleteTask] = useState(null);

  const [lastReferencedTask, setLastReferencedTask] = useState(null);
  const [lastReadTasks, setLastReadTasks] = useState([]);

  useEffect(() => {
    localStorage.setItem("voice-task-manager-tasks", JSON.stringify(tasks));
  }, [tasks]);

  function resolveTaskReference(commandData, tasks, lastReferencedTask, lastReadTasks) {
    const reference = commandData.reference;

    if (reference?.type === "last_task") {
      return lastReferencedTask;
    }

    if (reference?.type === "list_position") {
      if (reference.position === -1) {
        return lastReadTasks[lastReadTasks.length - 1];
      }

      if (reference.position === 0) {
        const middleIndex = Math.floor(lastReadTasks.length / 2);
        return lastReadTasks[middleIndex];
      }

      return lastReadTasks[reference.position - 1];
    }

    const target = commandData.target?.toLowerCase() || reference?.text?.toLowerCase();

    if (!target) return null;

    return tasks.find((task) =>
      task.title.toLowerCase().includes(target)
    );
  }

  function handleCommand(commandData) {
    if (commandData.intent === "create_task") {
      const newTasks = commandData.tasks.map((task) => ({
        id: crypto.randomUUID(),
        title: task.title,
        date: task.date,
        time: task.time,
      }));

      setTasks((prevTasks) => [...prevTasks, ...newTasks]);
      return commandData.response;
    }

    if (commandData.intent === "read_tasks") {
      const { summary, sortedTasks } = getTasksSummary(
        tasks,
        commandData
      );

      setLastReadTasks(sortedTasks);

      return summary;
    }

    if (commandData.intent === "update_task") {
      const target = commandData.target?.toLowerCase();

      const taskToUpdate = resolveTaskReference(
        commandData,
        tasks,
        lastReferencedTask,
        lastReadTasks
      );
      
      if (!taskToUpdate) {
        return "I could not find a matching task to update.";
      }

      let newTime = commandData.newTime || taskToUpdate.time;

      if (commandData.timeShiftMinutes) {
        const [hours, minutes] = taskToUpdate.time.split(":").map(Number);
        const date = new Date(taskToUpdate.date);
        date.setHours(hours, minutes + commandData.timeShiftMinutes);

        newTime = date.toTimeString().slice(0, 5);
      }

      const updatedTask = {
        ...taskToUpdate,
        date: commandData.newDate || taskToUpdate.date,
        time: newTime,
      };

      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === taskToUpdate.id ? updatedTask : task
        )
      );

      return commandData.response || `Updated ${updatedTask.title} to ${updatedTask.time}.`;
    }

    if (commandData.intent === "delete_task") {
      const target = commandData.target?.toLowerCase();

      const taskToDelete = resolveTaskReference(
        commandData,
        tasks,
        lastReferencedTask,
        lastReadTasks
      );

      if (!taskToDelete) {
        return "I could not find a matching task to delete.";
      }

      setPendingDeleteTask(taskToDelete);

      return `I found ${taskToDelete.title} at ${taskToDelete.time}. Should I delete it?`;
    }

    if (commandData.intent === "confirm") {
      if (!pendingDeleteTask) {
        return "There is nothing to confirm right now.";
      }

      setTasks((prevTasks) =>
        prevTasks.filter((task) => task.id !== pendingDeleteTask.id)
      );

      const deletedTitle = pendingDeleteTask.title;
      setPendingDeleteTask(null);

      return `Deleted ${deletedTitle}.`;
    }

    if (commandData.intent === "cancel") {
      if (!pendingDeleteTask) {
        return "There is nothing to cancel right now.";
      }

      setPendingDeleteTask(null);

      return "Okay, I will not delete it.";
    }

    setLastReferencedTask(updatedTask);

    return commandData.response;
  }

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
          setStatus("Understanding command...");

          const controller = new AbortController();

          const timeoutId = setTimeout(() => {
            controller.abort();
          }, 15000);

          const commandResponse = await fetch("http://localhost:3001/api/command", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ text: data.text }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          const commandData = await commandResponse.json();

          if (!commandResponse.ok) {
            throw new Error(commandData.error || "Command parsing failed");
          }

          setParsedCommand(commandData);
          const assistantResponse = handleCommand(commandData);
          setStatus("Command understood");
          speak(assistantResponse);

        } catch (error) {
          if (error.name === "AbortError") {
            setStatus("Command understanding timed out");
            speak("Sorry, understanding the command took too long. Please try again.");
            return;
          } else {
            console.error(error);
            setStatus("Transcription error");
            speak("Sorry, I could not transcribe that.");
          }
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

          {parsedCommand && (
            <pre className="parsed-command">
              {JSON.stringify(parsedCommand, null, 2)}
            </pre>
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
                  <div className="calendar-cell" key={`${day.toISOString()}-${hour}`}>
                    {tasks
                      .filter((task) => {
                        const cellDate = day.toISOString().split("T")[0];
                        const taskHour = Number(task.time?.split(":")[0]);

                        return task.date === cellDate && taskHour === hour;
                      })
                      .sort((a, b) => a.time.localeCompare(b.time))
                      .map((task) => (
                        <div className="task-card" key={task.id}>
                          <strong>{task.time}</strong>
                          <span>{task.title}</span>
                        </div>
                      ))}
                  </div>
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