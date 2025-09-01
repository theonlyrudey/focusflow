import { useMemo, useState } from 'react';
import { type Task } from "../state/types";
import { Sessions } from "../state/sessions";
import { rangePreset} from "../state/time.ts";

// Chart.js setup
import {
  Chart,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import * as React from "react";
Chart.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

type Props = {
  tasks: Task[];
};

type RangeKey = "today" | "7d" | "30d";

export default function Reports({ tasks } : Props) {
  const [range, setRange] = useState<RangeKey>("today");

  // sessions are read once per render
  const sessions = Sessions.all();

  // derive filtered + grouped data
  const { labels, minutesPerTask, tableRows, totals } = useMemo (() => {
    const [from, to] = rangePreset(range);

    //finished sessions in range
    const finished = sessions.filter(s =>
      typeof s.endAt === "number" &&
      typeof s.durationSec === "number" &&
      s.startAt >= from &&
      s.endAt < to
    );

    // group by taskId
    const map = new Map<string, { minutes: number; sessions: number; pauseMin: number }>();
    for (const s of finished) {
      const minutes = Math.max(0, Math.floor((s.durationSec ?? 0) / 60));
      const pauseMin = Math.max(0, Math.floor((s.totalPauseSec ?? 0) / 60));
      const row = map.get(s.taskId) ?? { minutes: 0, sessions: 0, pauseMin: 0 };
      row.minutes += minutes;
      row.sessions += 1;
      row.pauseMin += pauseMin;
      map.set(s.taskId, row);
    }

    // turn into arrays in task-name order
    const labels: string[] = [];
    const minutesPerTask: number[] = [];
    const tableRows = Array.from(map.entries()).map(([taskId, v]) => {
      const name = tasks.find(t => t.id === taskId)?.title ?? "(deleted task)";
      return { taskId, name, ...v };
    }).sort((a, b) => b.minutes - a.minutes);

    for (const row of tableRows) {
      labels.push(row.name);
      minutesPerTask.push(row.minutes);
    }

    const totals = {
      minutes: tableRows.reduce((a, r) => a + r.minutes, 0),
      sessions: tableRows.reduce((a, r) => a + r.sessions, 0),
      pauseMin: tableRows.reduce((a, r) => a + r.pauseMin, 0),
    };

    return { labels, minutesPerTask, tableRows, totals };
  }, [sessions, tasks, range]);

  const chartData = {
    labels,
    datasets: [
      {
        label: "Minutes",
        data: minutesPerTask,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true }
    }
  } as const;

  return (
    <section>
      <h2>Reports</h2>

      <div style = {{ display: "flex", gap: 8, marginBottom: 8 }}>
        <RangeButton value = "today" current={range} onChange={setRange} />
        <RangeButton value = "7d" current={range} onChange={setRange} />
        <RangeButton value = "30d" current={range} onChange={setRange} />
      </div>

      {labels.length === 0 ? (
        <p>No finished sessions in this range.</p>
      ) : (
        <>
          <div style={{ maxWidth: 720 }}>
            <Bar data={chartData} options={chartOptions} />
          </div>

          <div style={{ marginTop: 12 }}>
            <strong>Total</strong>: {totals.minutes} min • {totals.sessions} sessions • {totals.pauseMin} min paused
          </div>

          <table style={{ width: "100%", marginTop: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Task</th>
                <th style={th}>Minutes</th>
                <th style={th}>Sessions</th>
                <th style={th}>Paused (min)</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r) => (
                <tr key={r.taskId}>
                  <td style={td}>{r.name}</td>
                  <td style={td}>{r.minutes}</td>
                  <td style={td}>{r.sessions}</td>
                  <td style={td}>{r.pauseMin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

function RangeButton({
  value,
  current,
  onChange,
  }: {
  value: RangeKey;
  current: RangeKey;
  onChange: (v: RangeKey) => void;
}) {
  const active = current === value;
  return (
    <button
      onClick={() => onChange(value)}
      disabled={active}
      style={active ? {fontWeight: 600} : undefined}
    >
      {value === "today" ? "Today" : value === "7d" ? "Last 7 days" : "Last 30 days"}
    </button>
  );
}

const th: React.CSSProperties = { textAlign: "left", borderBottom: "1px solid #ddd", padding: "6px 4px" };
const td: React.CSSProperties = { borderBottom: "1px solid #eee", padding: "6px 4px" };