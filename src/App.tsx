import { useEffect, useState } from "react";
import Focus from "./components/Focus";
import Tasks from "./components/Tasks";
import { type Task} from "./state/types";
import { load, save } from "./state/storage";

const TASKS_KEY = "tasks:v1";

function App () {
  const [tasks, setTasks] = useState<Task[]>(() => load<Task[]>(TASKS_KEY, []));

  useEffect(() => {
    save(TASKS_KEY, tasks);
  }, [tasks]);

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
      <Focus tasks={tasks}/>

      <section>
        <h2>Reports</h2>
        <p>Charts will go here.</p>
      </section>

      <footer>
        <p>Alpha note: your data is stored locally in your browser.</p>
      </footer>
    </div>
  )
}

export default App
