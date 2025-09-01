import {type SetStateAction, useEffect, useMemo, useState} from "react";
import {type QueueItem, type Task} from "../state/types";
import { uid } from "../state/id";
import { load, save } from "../state/storage";
import * as React from "react";

const QUEUE_KEY = "queue:v1";

type Props = {
  tasks: Task[];
  queue: QueueItem[];
  setQueue: React.Dispatch<SetStateAction<QueueItem[]>>;
};

function mmssToSec(str: string): number {
  // supports "mm", "mm:ss" or just "ss"
  const s = str.trim();
  if (!s) return 0;
  if (s.includes(":")) {
    const [m, sec] = s.split(":").map(n=> Number(n));
    return (isNaN(m) ? 0 : m) * 60 + (isNaN(sec) ? 0 : sec);
  }
  // plain minutes by default
  const m = Number(s);
  if (!isNaN(m)) return m * 60;
  return 0;
}

function secToMMSS(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export default function Queue({ tasks, queue, setQueue } : Props) {
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [durationInput, setDurationInput] = useState<string>(""); // mm or mm:ss

  // Load from localStorage once (if App didn't already)
  useEffect(() => {
    if (queue.length === 0) {
      const persisted = load<QueueItem[]>(QUEUE_KEY, []);
      if (persisted.length > 0) setQueue(persisted);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist queue whenever it changes
  useMemo(() => {
    save(QUEUE_KEY, queue);
  }, [queue]);

  function addToQueue() {
    const t = tasks.find(x => x.id === selectedTaskId);
    if (!t) return;

    const sec =
      durationInput
      ? mmssToSec(durationInput)
      : (t.defaultDurationSec ?? 25 * 60);

    const item: QueueItem = { id : uid(), taskId: t.id, durationSec: Math.max(0, sec) };
    setQueue(prev => [... prev, item]);
    setDurationInput("");
  }

  function removeItem(id: string) {
    setQueue(prev => prev.filter(x => x.id !== id));
  }

  function moveUp(index: number) {
    if (index <= 0) return;
    setQueue(prev => {
      const arr = prev.slice();
      [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
      return arr;
    });
  }

  function moveDown(index: number) {
    setQueue(prev => {
      if (index >= prev.length - 1) return prev;
      const arr = prev.slice();
      [arr[index + 1], arr[index]] = [arr[index], arr[index + 1]];
      return arr;
    });
  }
  function setItemDuration(id: string, mmss: string) {
    const sec = mmssToSec(mmss);
    setQueue(prev => prev.map(q => q.id === id ? { ...q, durationSec: sec } : q));
  }

  function clearQueue() {
    setQueue([]);
  }

  return (
    <section>
      <h2>Queue (today's plan)</h2>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center"}}>
        <select value={selectedTaskId} onChange={e => setSelectedTaskId(e.target.value)}>
          <option value="">(choose task)</option>
          {tasks.map(t => (
            <option key={t.id} value={t.id}>
              {t.title} {t.defaultDurationSec ? `(${secToMMSS(t.defaultDurationSec)})` : ""}
            </option>
          ))}
        </select>

        <input
          placeholder="Duration (min or mm:ss)"
          value={durationInput}
          onChange={e => setDurationInput(e.target.value)}
          style={{ width: 180 }}
        />

        <button onClick={addToQueue} disabled={!selectedTaskId}>Add to queue</button>§
        <button onClick={clearQueue} disabled={queue.length === 0}>Clear</button>
      </div>

      {queue.length === 0 ? (
        <p>Queue is empty. Add items above.</p>
      ) : (
        <ol style={{paddingLeft: 18, marginTop: 12 }}>
          {queue.map((q, i) => {
            const task = tasks.find(t => t.id === q.taskId);
            return (
              <li key={q.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style ={{ minWidth: 140 }}>{task?.title ?? "(deleted task)"}</span>

                <label>
                  Duration:&nbsp;
                  <input
                    style={{ width: 120 }}
                    value={secToMMSS(q.durationSec)}
                    onChange={(e) => setItemDuration(q.id, e.target.value)}
                  />
                </label>

                <button onClick={() => moveUp(i)} disabled={i === 0}>↑</button>
                <button onClick={() => moveDown(i)} disabled={i === queue.length - 1}>↓</button>
                <button onClick={() => removeItem(q.id)}>Remove</button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}