import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import UploadSection from './UploadSection';
import FlashcardList from './FlashcardList';
import { BrainCircuit, Save, Loader2, Check } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Generator() {
  const [flashcards, setFlashcards] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [setTitle, setSetTitle] = useState('');

  const { user } = useAuth();
  const navigate = useNavigate();

  const handleFileUpload = async (file, cardType) => {
    setIsGenerating(true);
    setError('');
    setSaved(false);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('card_type', cardType);
    
    try {
      const response = await axios.post('http://127.0.0.1:8000/api/generate-flashcards', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setFlashcards(response.data.flashcards);
      setSetTitle(file.name.replace('.pdf', ''));
    } catch (err) {
      console.error("Upload error:", err);
      setError(err.response?.data?.detail || 'An error occurred while generating flashcards.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUrlSubmit = async (url, cardType) => {
    setIsGenerating(true);
    setError('');
    setSaved(false);
    
    try {
      const response = await axios.post('http://127.0.0.1:8000/api/generate-from-url', { url, card_type: cardType });
      setFlashcards(response.data.flashcards);
      
      try {
        const domain = new URL(url).hostname.replace('www.', '');
        setSetTitle(`Flashcards from ${domain}`);
      } catch (e) {
        setSetTitle('Web Link Flashcards');
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError(err.response?.data?.detail || 'An error occurred while generating flashcards from URL.');
    } finally {
      setIsGenerating(false);
    }
  };

  const resetSession = () => {
    setFlashcards([]);
    setError('');
    setSaved(false);
  };

  const saveSet = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    if (!setTitle.trim()) return;
    
    setSaving(true);
    try {
      await axios.post('http://127.0.0.1:8000/api/flashcard-sets/', {
        title: setTitle,
        flashcards: flashcards
      });
      setSaved(true);
    } catch (err) {
      console.error(err);
      alert("Failed to save flashcard set.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-8 flex flex-col items-center">
      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-5xl mx-auto flex flex-col items-center text-center mb-12"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-brand-primary/20 rounded-2xl glass-panel shadow-[0_0_15px_rgba(139,92,246,0.3)] cursor-pointer" onClick={() => navigate(user ? '/dashboard' : '/')}>
            <BrainCircuit className="w-8 h-8 text-brand-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Learn<span className="gradient-text-primary">AID</span>
          </h1>
        </div>
        <p className="text-brand-muted max-w-xl text-lg">
          Transform documents, web articles, and YouTube videos into interactive flashcards instantly using AI.
        </p>
      </motion.header>

      {/* Main Content Area */}
      <main className="w-full max-w-5xl mx-auto flex-1 flex flex-col items-center">
        <AnimatePresence mode="wait">
          {flashcards.length === 0 ? (
            <UploadSection 
              key="upload" 
              onUploadFile={handleFileUpload}
              onUploadUrl={handleUrlSubmit}
              isGenerating={isGenerating} 
              error={error} 
            />
          ) : (
            <motion.div key="flashcards" className="w-full relative" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              
              {/* Save Bar */}
              <div className="mb-8 flex flex-col sm:flex-row items-center gap-4 p-4 glass-panel border border-brand-border rounded-2xl justify-between w-full">
                <input 
                  type="text" 
                  value={setTitle} 
                  onChange={(e) => setSetTitle(e.target.value)}
                  className="bg-brand-bg px-4 py-2 rounded-xl border border-brand-border focus:border-brand-primary outline-none flex-1 w-full"
                  placeholder="Set Title"
                />
                
                <div className="flex gap-3 w-full sm:w-auto">
                  {saved ? (
                    <button disabled className="px-6 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-xl font-medium flex items-center gap-2 justify-center w-full sm:w-auto">
                      <Check className="w-4 h-4" /> Saved!
                    </button>
                  ) : (
                    <button 
                      onClick={saveSet} 
                      disabled={saving}
                      className="px-6 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl font-medium flex items-center gap-2 justify-center w-full sm:w-auto transition-all"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Set
                    </button>
                  )}
                  
                  {user && (
                    <button onClick={() => navigate('/dashboard')} className="px-4 py-2 bg-brand-surface border border-brand-border hover:bg-brand-primary/20 rounded-xl whitespace-nowrap">
                      Dashboard
                    </button>
                  )}
                </div>
              </div>

              <FlashcardList 
                flashcards={flashcards} 
                setFlashcards={setFlashcards}
                onReset={resetSession} 
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
