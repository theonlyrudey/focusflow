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
  onFocusModeChange?: (active: boolean) => void;
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

export default function Focus({ tasks, queue = [], setQueue, onFocusModeChange } : Props) {
  const [isFocusView, setIsFocusView] = React.useState(false);
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
    onFocusModeChange?.(state !== "idle");
  }, [index, remainingSec, state, currentSessionId, onFocusModeChange]);

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
    setIsFocusView(true);
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
      setIsFocusView(false);
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
        case "Escape":
          if (!isFocusView) break;
          e.preventDefault();
          setIsFocusView(false);
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, pause, resume, next, add5, restartItem, isFocusView]);

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
  const shouldInlineStart = showOnlyStart || !hasQueue;

  useEffect(() => {
    onFocusModeChange?.(!shouldInlineStart);
  }, [onFocusModeChange, shouldInlineStart]);

  return (
    shouldInlineStart ? (
      // ===== Inline (setup) view =====
      <div style={{ display: "flex", justifyContent: "center", margin: "16px 0" }}>
        {!hasQueue ? (
          <p style={{ opacity: 0.8 }}>Queue is empty. Add tasks above to start.</p>
        ) : (
          <button
            onClick={start}
            style={{
              padding: "16px 28px",
              fontSize: 22,
              fontWeight: 700,
              borderRadius: 10,
              border: "1px solid #ccc",
              background: "#f6f6f6",
              minWidth: 240,
            }}
          >
            Start
          </button>
        )}
      </div>
    ) : (
      // ===== Fullscreen focus view =====
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "#0e0e10",
          color: "#fff",
          zIndex: 1000,
          display: "grid",
          gridTemplateRows: "1fr auto",
          padding: 24,
        }}
      >
        <div style={{ display: "grid", placeItems: "center", textAlign: "center" }}>
          <div style={{ fontSize: 18, marginBottom: 6, opacity: 0.9 }}>
            {currentTask?.title ?? "(unknown task)"}{/* won’t show when queue empty because we’re not in fullscreen then */}
          </div>
          <div
            style={{
              fontSize: 88,
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
              margin: "10px 0 14px",
            }}
            aria-live="polite"
          >
            {fmt(remainingSec)}
          </div>

          {/* BIG NEXT */}
          <button
            onClick={next}
            style={{
              padding: "16px 28px",
              fontSize: 22,
              fontWeight: 700,
              borderRadius: 10,
              border: "1px solid #3a3a3a",
              background: "#1d1d22",
              minWidth: 240,
            }}
          >
            Next ▶
          </button>

          {/* helpers */}
          <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "center" }}>
            {state === "running" ? (
              <button onClick={pause}>Pause</button>
            ) : (
              <button onClick={resume} disabled={remainingSec === 0}>Resume</button>
            )}
            <button onClick={add5}>+5 min</button>
            <button onClick={restartItem}>Restart</button>
          </div>
        </div>

        <div>
          <details>
            <summary>Queue preview</summary>
            <ol style={{ paddingLeft: 18, marginTop: 8 }}>
              {queue.map((q, i) => {
                const t = tasks.find(x => x.id === q.taskId);
                return (
                  <li key={q.id} style={{ opacity: i < safeIndex ? 0.6 : 1 }}>
                    {i === safeIndex ? <strong>{t?.title}</strong> : t?.title} – {Math.floor(q.durationSec / 60)} min
                  </li>
                );
              })}
            </ol>
          </details>
          <div style={{ color: "#aaa", fontSize: 12, marginTop: 8 }}>
            Shortcuts: Space = Pause/Resume • + = +5 min • → = Next • R = Restart
          </div>
        </div>
      </div>
    )
  );
}