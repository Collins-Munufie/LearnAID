import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Generator from './components/Generator';
import AuthPage from './components/AuthPage';
import Dashboard from './components/Dashboard';
import StudyMode from './components/StudyMode';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-brand-muted">Initializing LearnAID...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/generate" />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <AuthPage />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/generate" element={<Generator />} />
      <Route path="/study/:setId" element={user ? <StudyMode /> : <Navigate to="/login" />} />
    </Routes>
  );
}

export default App;
