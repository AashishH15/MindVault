import { useState } from "react";
import reactLogo from "./assets/react.svg";
import { greet } from "./ipc";
import DebugPanel from "./DebugPanel";
import "./App.css";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function onGreet() {
    const result = await greet(name);
    if ("ok" in result) {
      setGreetMsg(result.ok);
      return;
    }
    setGreetMsg(result.err);
  }

  return (
    <main className="container">
      <h1>MindVault</h1>

      <div className="row">
        <a href="https://vite.dev" target="_blank">
          <img src="/vite.svg" className="logo vite" alt="Vite logo" />
        </a>
        <a href="https://tauri.app" target="_blank">
          <img src="/tauri.svg" className="logo tauri" alt="Tauri logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <p>Click on the Tauri, Vite, and React logos to learn more.</p>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          onGreet();
        }}
      >
        <input
          id="greet-input"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
        />
        <button type="submit">Greet</button>
      </form>
      <p>{greetMsg}</p>
      <DebugPanel />
    </main>
  );
}

export default App;
