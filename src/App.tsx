import Tasks from "./components/Tasks";
function App () {
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

      <Tasks />

      <section>
        <h2>Focus</h2>
        <p>Countdown timer will go here.</p>
      </section>

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
