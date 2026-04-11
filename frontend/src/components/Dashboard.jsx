import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { BrainCircuit, Loader2, Play, Plus, BookOpen, Download } from 'lucide-react';
import axios from 'axios';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    fetchSets();
  }, [user]);

  const fetchSets = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:8000/api/flashcard-sets');
      setSets(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const exportToCSV = (set) => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Question,Answer\n" 
      + set.flashcards.map(card => {
          const q = card.question.replace(/"/g, '""');
          const a = card.answer.replace(/"/g, '""');
          return `"${q}","${a}"`;
      }).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${set.title.replace(/\s+/g, '_')}_flashcards.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col pt-8 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3 text-brand-text">
             <BrainCircuit className="text-brand-primary w-8 h-8"/> My Dashboard
          </h1>
          <p className="text-brand-muted">Welcome back, {user?.email}</p>
        </div>
        <div className="flex gap-4">
          <button onClick={() => navigate('/generate')} className="px-5 py-2.5 bg-brand-primary shadow-lg shadow-brand-primary/30 text-white rounded-xl font-medium flex items-center gap-2 transition-all hover:scale-105">
            <Plus className="w-4 h-4" /> New Set
          </button>
          <button onClick={handleLogout} className="px-5 py-2.5 bg-brand-surface text-brand-text border border-brand-border rounded-xl font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all">
            Logout
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-primary" /></div>
      ) : sets.length === 0 ? (
        <div className="text-center py-20 glass-panel rounded-3xl border border-brand-border text-brand-text">
          <BookOpen className="w-16 h-16 text-brand-muted mx-auto mb-4" />
          <h3 className="text-2xl font-medium mb-3">No flashcards yet</h3>
          <p className="text-brand-muted mb-8 max-w-md mx-auto">Generate your first flashcard set using AI from any PDF document, Web Article, or YouTube video.</p>
          <button onClick={() => navigate('/generate')} className="px-8 py-4 bg-brand-primary shadow-lg shadow-brand-primary/30 text-white hover:scale-105 transition-all rounded-xl font-medium inline-flex items-center gap-2">
            Generate Flashcards
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sets.map(set => (
            <motion.div 
              whileHover={{ y: -5 }}
              key={set.id} 
              className="glass-panel p-6 rounded-2xl border border-brand-border flex flex-col h-full hover:shadow-xl transition-shadow relative"
            >
              <button 
                onClick={() => exportToCSV(set)}
                className="absolute top-4 right-4 p-2 text-brand-muted hover:text-brand-primary transition-colors"
                title="Export to CSV"
              >
                <Download className="w-5 h-5"/>
              </button>
              <h3 className="text-xl font-bold mb-2 line-clamp-2 text-brand-text pr-8">{set.title}</h3>
              <p className="text-brand-muted text-sm mb-6">{set.flashcards.length} cards • {new Date(set.created_at).toLocaleDateString()}</p>
              <div className="mt-auto pt-4 border-t border-brand-border/50">
                <button 
                  onClick={() => navigate(`/study/${set.id}`)}
                  className="w-full py-3 bg-brand-secondary hover:bg-brand-secondary-hover text-white rounded-xl transition-all flex items-center justify-center gap-2 font-medium shadow-md shadow-brand-secondary/20"
                >
                  <Play className="w-4 h-4 text-white" /> Study Now
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
