import { useCallback, useEffect, useMemo, useState } from "react";
import { fmt } from "../state/time";
import { load, save } from "../state/storage";
import {type QueueItem, type Task} from "../state/types";
import { Sessions } from "../state/sessions";
import * as React from "react";

// We'll read tasks by asking the user to pass them from App
// to keep this component focused on timer logic.
type Props = {
  tasks: Task[];
  queue?: QueueItem[];
  setQueue: React.Dispatch<React.SetStateAction<QueueItem[]>>;
};

type TimerState = "idle" | "running" | "paused";

const STORAGE_KEY = "focusTimer:v1";

type Saved = {
  index: number;
  remainingSec: number;
  state: TimerState;
  currentSessionId?: string | null;
  endAtTs?: number | null;
}

const DEFAULT_SAVED: Saved = {
  index: 0,
  remainingSec: 0,
  state: "idle",
  currentSessionId: null,
  endAtTs: null,
};

export default function Focus({ tasks, queue = [], setQueue } : Props) {
  const [index, setIndex] = useState<number>(() => load<Saved>(STORAGE_KEY, DEFAULT_SAVED).index);
  const [remainingSec, setRemainingSec] = useState<number>(() => load<Saved>(STORAGE_KEY, DEFAULT_SAVED).remainingSec);
  const [state, setState] = useState<TimerState>(() => load<Saved>(STORAGE_KEY, DEFAULT_SAVED).state);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => {
    return load<Saved>(STORAGE_KEY, DEFAULT_SAVED).currentSessionId ?? null;
  });
  const endAtTsRef = React.useRef<number | null>(
    load<Saved>(STORAGE_KEY, DEFAULT_SAVED).endAtTs ?? null
  );

  const setRemainingFromEndAt = React.useCallback(() => {
    if (endAtTsRef.current == null) return;
    const msLeft = endAtTsRef.current - Date.now();
    const secLeft = Math.max(0, Math.ceil(msLeft / 1000));
    if (secLeft !== remainingSec) {
      setRemainingSec(secLeft);
    }
  }, [remainingSec]);

  // Persist small UI state
  useEffect(() => {
    const payload: Saved = {
      index,
      remainingSec,
      state,
      currentSessionId,
      endAtTs: endAtTsRef.current ?? null,
    };
    save(STORAGE_KEY, payload);
  }, [index, remainingSec, state, currentSessionId]);

  // Safeguards so we never crash when queue is empty
  const hasQueue = Array.isArray(queue) && queue.length > 0;
  const safeIndex = hasQueue
    ? Math.max(0, Math.min(index, queue.length - 1))
    : 0;

  const currentItem = hasQueue ? queue[safeIndex] : undefined;
  const currentTask = useMemo(() => {
    if (!currentItem) return null;
    return tasks.find(t => t.id === currentItem.taskId) ?? null;
  }, [currentItem, tasks]);

  // Actions
  const start = useCallback(() => {
    if (!currentItem) return;
    const dur = Math.max(0, Math.floor(currentItem.durationSec));
    const sid = Sessions.start(currentItem.taskId);

    setCurrentSessionId(sid);
    setRemainingSec(dur);
    setState("running");
    endAtTsRef.current = Date.now() + dur * 1000;
  }, [currentItem]);

  const pause = useCallback(() => {
    setState("paused");
    if (currentSessionId) Sessions.pause(currentSessionId);
    if (endAtTsRef.current != null){
      const msLeft = endAtTsRef.current - Date.now();
      setRemainingSec(Math.max(0, Math.ceil(msLeft / 1000)));
    }
    endAtTsRef.current = null;
  }, [currentSessionId]);

  const resume = useCallback(() => {
    if (remainingSec > 0) {
      setState("running");
      if (currentSessionId) Sessions.resume(currentSessionId);
      endAtTsRef.current = Date.now() + remainingSec * 1000;
    }
  }, [remainingSec, currentSessionId]);

  const add5 = useCallback(() => { setRemainingSec(s => s + 300); }, []);

  // Next : end session, remove current item, start next session if any
  const next = useCallback(() => {
    if (currentSessionId) {
      Sessions.end(currentSessionId);
      setCurrentSessionId(null);
    }

    if (!queue[safeIndex]) {
      setState("idle");
      setRemainingSec(0);
      setIndex(0);
      endAtTsRef.current = null;
      return;
    }

    const newQueue = queue.slice();
    newQueue.splice(safeIndex, 1); // remove current item
    setQueue(newQueue);

    const nextItem = newQueue[safeIndex];

    if (nextItem) {
      const sid = Sessions.start(nextItem.taskId);
      setCurrentSessionId(sid);

      setRemainingSec(Math.max(0, Math.floor(nextItem.durationSec)));
      setState("running");
      endAtTsRef.current = Date.now() + Math.max(0, Math.floor(nextItem.durationSec)) * 1000;
      // keep the same index because items shifted left
    } else {
      // nothing left at this index, we finished the last item
      setState("idle");
      setRemainingSec(0);
      setIndex(0);
      endAtTsRef.current = null;
    }
  }, [safeIndex, queue, setQueue, currentSessionId]);

  const restartItem = useCallback(() => {
    if (!currentItem) return;
    setRemainingSec(Math.max(0, Math.floor(currentItem.durationSec)));
    setState("running");
    endAtTsRef.current = Date.now() + Math.max(0, Math.floor(currentItem.durationSec)) * 1000;
  }, [currentItem]);

  const fastForwardIfOverdue = useCallback(() => {
    if (state !== "running") return;
    if (endAtTsRef.current == null) return;

    let overflowSec = Math.floor((Date.now() - endAtTsRef.current) / 1000); // >0 means we're late
    if (overflowSec <= 0) {
      setRemainingFromEndAt();
      return;
    }

    if (currentSessionId) {
      Sessions.end(currentSessionId);
      setCurrentSessionId(null);
    }

    let idx = safeIndex + 1;
    while (overflowSec > 0 && idx < queue.length) {
      const d = Math.max(0, Math.floor(queue[idx].durationSec));
      if (overflowSec >= d) {
        overflowSec -= d;
        idx += 1;
      } else {
        break;
      }
    }

    if (idx >= queue.length) {
      setIndex(0);
      setState("idle");
      setRemainingSec(0);
      endAtTsRef.current = null;
      return;
    }

    const landed = queue[idx];
    const landedTaskId = landed.taskId;
    const landedDur = Math.max(0, Math.floor(landed.durationSec));
    const residual = landedDur - Math.max(0, overflowSec);

    const sid = Sessions.start(landedTaskId);
    setCurrentSessionId(sid);
    setIndex(idx);
    setRemainingSec(residual);
    setState("running");
    endAtTsRef.current = Date.now() + residual * 1000;
  }, [state, setRemainingFromEndAt, currentSessionId, safeIndex, queue]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        fastForwardIfOverdue();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [fastForwardIfOverdue]);

  useEffect(() => {
    const saved = load<Saved>(STORAGE_KEY, DEFAULT_SAVED);
    if (saved.state === "running" && saved.endAtTs) {
      endAtTsRef.current = saved.endAtTs;
      fastForwardIfOverdue();
    }
  }, [fastForwardIfOverdue]);

  // The ticking mechanism: use wall-clock delta so background tabs catch up correctly
  useEffect(() => {
    if (state !== "running") return;
    const int = setInterval(() => {
      if (endAtTsRef.current == null) {
        setRemainingSec(prev => Math.max(0, prev - 1));
        return;
      }
      const msLeft = endAtTsRef.current - Date.now();
      const secLeft = Math.max(0, Math.ceil(msLeft / 1000));
      if (secLeft <= 0) {
        clearInterval(int);
        setTimeout(() => next(), 0);
        setRemainingSec(0)
      } else {
        setRemainingSec(secLeft);
      }
    }, 1000);
    return () => clearInterval(int);
  }, [state, next]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      switch (e.key) {
        case " ":
          e.preventDefault();
          if (state === "running") { pause(); } else { resume(); }
          break;
        case "ArrowRight":
          e.preventDefault();
          next();
          break;
        case "+":
          e.preventDefault();
          add5();
          break;
        case "r":
        case "R":
          if (state !== "running") break;
          e.preventDefault();
          restartItem();
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, pause, resume, next, add5, restartItem]);

  useEffect(() => {
    // If queue shrank and the current index is now invalid, reset
    if (!hasQueue) {
      if (currentSessionId) {
        Sessions.end(currentSessionId);
        setCurrentSessionId(null);
      }
      if (index !== 0) setIndex(0);
      if (state !== "idle") setState("idle");
      if (remainingSec !== 0) setRemainingSec(0);
      return;
    }

    if (index < 0 || index > queue.length - 1) {
      setIndex(Math.min(index, queue.length - 1));
    }
  }, [hasQueue, index, remainingSec, state, queue.length, currentSessionId]);

  // handle queue changes
  useEffect(() => {
    if (!queue[safeIndex]) {
      // if the current index is out of range, reset
      setIndex(0);
      setState("idle");
      setRemainingSec(0);
    }
  }, [queue, safeIndex]);

  const showOnlyStart = state === "idle" && remainingSec === 0 && hasQueue;

  return (
    <section>
      <h2>Focus (queue runner)</h2>

      {queue.length === 0 ? (
        <p>Queue is empty. Add items above to start.</p>
      ) : (
        <>
          <p>
            Now: <strong>{currentTask?.title ?? "(unknown task)"}</strong>&nbsp;
          </p>

          {/* Countdown */}
          <div style={{ fontSize: 48, fontVariantNumeric: "tabular-nums" }}>
            {fmt(remainingSec)}
          </div>

          {/* Controls */}
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {showOnlyStart ? (
              <button
                onClick={start}
                style={{ padding: "10px 18px", fontSize: 16 }}
              >Start
              </button>
            ) : (
              <>
                <button
                  onClick={next}
                  style={{
                    padding: "12px 22px",
                    fontSize: 18,
                    fontWeight: 600,
                    border: "1px solid #ccc",
                    borderRadius: 6,
                    background: "#efefef"
                  }}
                >
                  Next ▶
                </button>
                {state === "running"
                  ? (<button onClick={pause}>Pause</button> )
                  : ( <button onClick={resume} disabled={remainingSec === 0}>Resume</button>)
                }
                <button onClick={add5}>+5 min</button>
                <button onClick={restartItem}>Restart</button>
              </>
              )}
          </div>

          {/* Small hint */}
          <p style={{ color: "#666", marginTop: 8 }}>
            Shortcuts: Space = Pause/Resume • + = +5 min • → = Next
          </p>

          <details style={{ marginTop: 8 }}>
            <summary>Queue preview</summary>
            <ol style={{ paddingLeft: 18, marginTop: 8 }}>
              {queue.map((q, i) => {
                const t = tasks.find(x => x.id === q.taskId);
                return (
                  <li key={q.id} style={{ opacity: i < safeIndex ? 0.6 : 1 }}>
                    {i === safeIndex ? <strong>{t?.title}</strong> : t?.title} - {Math.floor(q.durationSec / 60)} min
                  </li>
                );
              })}
            </ol>
          </details>
        </>
      )}
    </section>
  );
}