import Dashboard from './components/Dashboard';
import './App.css';

function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
     

      <main style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <Dashboard />
      </main>
    </div>
  );
}

export default App;