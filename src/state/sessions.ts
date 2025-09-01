import { type Session } from "./types";
import { load, save } from "./storage"
import { uid } from "./id"

const KEY = "sessions:v1"

function getAll(): Session[] {
  return load<Session[]>(KEY, []);
}

function putAll(list: Session[]) {
  save(KEY, list);
}

function sumPauses(pauses: Session["pauses"]) : number {
  let total = 0;
  for (const p of pauses) {
    if (typeof p.resumeAt === "number") {
      total += Math.max(0, p.resumeAt - p.pauseAt);
    }
  }
  return Math.floor(total / 1000);
}

export const Sessions = {
  all(): Session[] {
    return getAll();
  },

  start(taskId: string): string {
    const s: Session = {
      id: uid(),
      taskId,
      startAt: Date.now(),
      pauses: [],
      totalPauseSec: 0
    };
    const list = getAll();
    list.push(s);
    putAll(list);
    return s.id;
  },

  pause(sessionId: string) {
    const list = getAll();
    const s = list.find(x => x.id === sessionId);
    if (!s) return;
    const last = s.pauses[s.pauses.length - 1];
    if (!last || typeof last.resumeAt === "number") {
      s.pauses.push({pauseAt: Date.now()});
      putAll(list);
    }
  },

  resume(sessionId: string) {
    const list = getAll();
    const s = list.find(x => x.id === sessionId);
    if (!s) return;
    const last = s.pauses[s.pauses.length - 1];
    if (last && typeof last.resumeAt === "number") {
      last.resumeAt = Date.now();
      putAll(list);
    }
  },

  end(sessionId: string) {
    const list = getAll();
    const s = list.find(x => x.id === sessionId);
    if (!s) return;

    const now = Date.now();
    s.endAt = now;

    //if paused at end, close it at end time
    const last = s.pauses[s.pauses.length - 1];
    if (last && typeof last.resumeAt === "number") {
      last.resumeAt = now;
    }

    s.totalPauseSec = sumPauses(s.pauses);

    const totalElapsedSec = Math.floor((s.endAt - s.startAt) / 1000);
    s.durationSec = Math.max(0, totalElapsedSec - s.totalPauseSec);

    putAll(list);
  }
};