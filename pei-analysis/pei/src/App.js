import Dashboard from './components/Dashboard';
import './App.css';

function App() {
  return (
    <div>
      <nav className="main-nav">
        <div className="nav-container">
          <h1 className="logo">Vegetation Analysis App</h1>
        </div>
      </nav>

      <main className="relative flex-1">
        <Dashboard />
      </main>
    </div>
  );
}

export default App;