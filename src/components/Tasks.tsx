import { useState } from "react";
import {type Task } from "../state/types.ts";
import { uid } from "../state/id.ts"
import * as React from "react";

type Props = {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
};

function minsToSec(m: number) { return Math.max(0, Math.floor(m * 60)); }
function secToMins(s: number) {return Math.floor((s || 0) / 60); }

export default function Tasks({ tasks, setTasks}: Props) {
  const [newTitle, setNewTitle] = useState("");
  const [mins, setMins] = useState<number>(25);

  function addTask() {
    const title = newTitle.trim();
    if (!title) return;
    const t: Task = {
      id: uid(),
      title,
      createdAt: Date.now(),
      defaultDurationSec: minsToSec(mins)
    };
    setTasks(prev => [...prev, t]);
    setNewTitle("");
    setMins(25);
  }

  function deleteTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  function renameTask(id: string, title: string) {
    setTasks(prev =>
      prev.map(t => (t.id === id ? { ...t, title } : t)));
  }

  function setTaskDefaultMins(id: string, newMins: number) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, defaultDurationSec: minsToSec(newMins) } : t));
  }

  return (
    <section>
      <h2>Tasks</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault(); // don't refresh the page
          addTask();
        }}
        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
      >
        <input
          placeholder="Task title..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <label>
          Default (min): {" "}
          <input
            type="number"
            min={0}
            value={mins}
            onChange={(e) => setMins(Number(e.target.value))}
            style={{ width: 80 }}
          />
        </label>
        <button type="submit">Add</button>
      </form>

      {tasks.length === 0 ? (
        <p> No tasks yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 12 }}>
          {tasks.map((t) => (
            <li key={t.id} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
              {/* Editable title: it's an input whose value is t.title */}
              <input
                value={t.title}
                onChange={(e) => renameTask(t.id, e.target.value)}
                style={{ flex: 1}}
              />
              <label>
                Default (min): {" "}
                <input
                  type="number"
                  min={0}
                  value={secToMins(t.defaultDurationSec ?? 0)}
                  onChange={(e) => setTaskDefaultMins(t.id, Number(e.target.value))}
                  style={{ flex: 1}}
                />
              </label>
              <button onClick={() => deleteTask(t.id)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}