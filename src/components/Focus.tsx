import { useCallback, useEffect, useMemo, useState } from "react";
import { fmt } from "../state/time";
import { load, save } from "../state/storage";
import { type Task } from "../state/types";

// We'll read tasks by asking the user to pass them from App
// to keep this component focused on timer logic.
type Props = {
  tasks: Task[];
};

type TimerState = "idle" | "running" | "paused";

// Keep a bit of state in localStorage so refreshes don't lose it
const STORAGE_KEY = "focus:ui:v1";

type Saved = {
  selectedTaskId: string | null;
  defaultMinutes: number;
  remainingSec: number;
  state: TimerState;
}

const DEFAULT_SAVED: Saved = {
  selectedTaskId: null,
  defaultMinutes: 25,
  remainingSec: 25 * 60,
  state: "idle",
};

export default function Focus({ tasks } : Props) {
  // UI state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(() => {
    return load<Saved>(STORAGE_KEY, DEFAULT_SAVED).selectedTaskId;
  });
  const [defaultMinutes, setDefaultMinutes] = useState<number>(() => {
    return load<Saved>(STORAGE_KEY, DEFAULT_SAVED).defaultMinutes;
  });
  const [remainingSec, setRemainingSec] = useState<number>(() => {
    return load<Saved>(STORAGE_KEY, DEFAULT_SAVED).remainingSec;
  });
  const [state, setState] = useState<TimerState>(() => {
    return load<Saved>(STORAGE_KEY, DEFAULT_SAVED).state;
  });

  // Persist lightweight UI state so a refresh isn't heavy
  useEffect(() => {
    const payload: Saved = { selectedTaskId, defaultMinutes, remainingSec, state };
    save(STORAGE_KEY, payload);
  }, [selectedTaskId, defaultMinutes, remainingSec, state]);

  // Derived data: current task + next task id
  const currentIndex = useMemo(
    () => tasks.findIndex(t => t.id === selectedTaskId),
    [tasks, selectedTaskId]
  );
  const currentTask = currentIndex >= 0 ? tasks[currentIndex] : null;
  const nextTaskId = currentIndex >= 0  && currentIndex +1 < tasks.length ?
    tasks[currentIndex + 1].id : null;

  // The ticking mechanism: run every 1000ms only when "running"
  useEffect(() => {
    if (state !== "running") return;
    const int = setInterval(() => {
      setRemainingSec(prev => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(int);
          setState("idle");
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(int);
  }, [state]);

  // Actions
  function start() {
    const minutes = Math.max(1, Math.floor(defaultMinutes) || 25);
    if (!selectedTaskId && tasks.length > 0) {
      setSelectedTaskId(tasks[0].id);
    }
    setRemainingSec(minutes * 60);
    setState("running");
  }

  function pause() {
    setState("paused");
  }

  const resume = useCallback(() => {
    if (remainingSec > 0) {
      setState("running");
    }
  }, [remainingSec]);

  function add5() {
    setRemainingSec(s => s + 300);
  }

  const next = useCallback(() => {
    if (nextTaskId) {
      setSelectedTaskId(nextTaskId);
      setRemainingSec(Math.max(1, Math.floor(defaultMinutes) || 25) * 60);
      setState("running");
    } else {
      setState("idle");
    }
  }, [defaultMinutes, nextTaskId]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      switch (e.key) {
        case " ":
          e.preventDefault();
          if (state === "running") {
            pause();
          } else {
            resume();
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          next();
          break;
        case "+":
          e.preventDefault();
          add5();
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, nextTaskId, remainingSec, defaultMinutes, next, resume]);

  return (
    <section>
      <h2>Focus</h2>

      {/* Task picker */}
      <div>
        <label>
          Task:&nbsp;
          <select
            value={selectedTaskId ?? ""}
            onChange={e => setSelectedTaskId(e.target.value || null)}
          >
            <option value="">(choose a task)</option>
            {tasks.map(t => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Session length input (minutes) */}
      <div style={{ marginTop: 8}}>
        <label>
          Session length (minutes):&nbsp;
          <input
            type="number"
            min={1}
            value={defaultMinutes}
            onChange={e => setDefaultMinutes(Number(e.target.value))}
            style={{ width: 80}}
          />
        </label>
      </div>

      {/* Countdown */}
      <div style={{ marginTop: 12, fontSize: 48, fontVariantNumeric: "tabular-nums" }}>
        {fmt(remainingSec)}
      </div>

      {/* Controls */}
      <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {state === "running" ? (
          <button onClick={pause}>Pause</button>
        ) : (
          <button onClick={currentTask ? resume : start}>
            {currentTask ? "Resume" : "Start"}
          </button>
        )}
        <button onClick={add5}>+5 min</button>
        <button onClick={next}>Next ▶</button>
      </div>

      {/* Small hint */}
      <p style={{ color: "#666", marginTop: 8 }}>
        Shortcuts: Space = Pause/Resume • + = +5 min • → = Next
      </p>
    </section>
  );
}