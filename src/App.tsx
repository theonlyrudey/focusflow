import { useEffect, useState } from "react";
import Focus from "./components/Focus";
import Tasks from "./components/Tasks";
import Queue from "./components/Queue";
import Reports from "./components/Reports";
import { type Task, type QueueItem} from "./state/types";
import { load, save } from "./state/storage";

const TASKS_KEY = "tasks:v1";
const QUEUE_KEY = "queue:v1";

function App () {
  const [tasks, setTasks] = useState<Task[]>(() => load<Task[]>(TASKS_KEY, []));
  const [queue, setQueue] = useState<QueueItem[]>(() => load<QueueItem[]>(QUEUE_KEY, []));

  useEffect(() => { save(TASKS_KEY, tasks); }, [tasks]);
  useEffect(() => { save(QUEUE_KEY, queue); }, [queue]);

  return (
    <div className="container">
      <header>
        <h1>Focus Flow (alpha)</h1>
        <nav>
          <a href="https://forms.gle" target="_blank" rel="noreferrer">
            Feedback
          </a>
        </nav>
      </header>

      <Tasks tasks={tasks} setTasks={setTasks} />
      <Queue tasks={tasks} queue={queue} setQueue={setQueue} />
      <Focus tasks={tasks} queue={queue} setQueue={setQueue}/>
      <Reports tasks={tasks} />

      <footer>
        <p>Alpha note: your data is stored locally in your browser.</p>
      </footer>
    </div>
  )
}

export default App
