import { useState } from "react";
import {type Task } from "../state/types.ts";
import { uid } from "../state/id.ts"
import * as React from "react";

type Props = {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
};

export default function Tasks({ tasks, setTasks}: Props) {
  const [newTitle, setNewTitle] = useState("");

  function addTask() {
    const title = newTitle.trim();
    if (!title) return;
    const t: Task = {id: uid(), title, createdAt: Date.now() };
    setTasks(prev => [...prev, t]);
    setNewTitle("");
  }

  function deleteTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  function renameTask(id: string, title: string) {
    setTasks(prev =>
      prev.map(t => (t.id === id ? { ...t, title } : t)));
  }

  return (
    <section>
      <h2>Tasks</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault(); // don't refresh the page
          addTask();
        }}
        style={{ display: "flex", gap: 8 }}
      >
        <input
          placeholder="Add a task..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <button type="submit">Add</button>
      </form>

      {tasks.length === 0 ? (
        <p> No tasks yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 12 }}>
          {tasks.map((t) => (
            <li key={t.id} style={{ display: "flex", gap: 8, marginBottom: 8}}>
              {/* Editable title: it's an input whose value is t.title */}
              <input
                value={t.title}
                onChange={(e) => renameTask(t.id, e.target.value)}
                style={{ flex: 1}}
              />
              <button onClick={() => deleteTask(t.id)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}