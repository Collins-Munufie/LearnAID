import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Check, X, RotateCcw, BrainCircuit, Play } from 'lucide-react';
import axios from 'axios';

export default function StudyMode() {
  const { setId } = useParams();
  const navigate = useNavigate();
  
  const [flashcardSet, setFlashcardSet] = useState(null);
  const [cards, setCards] = useState([]); // Currently active queue
  const [masteredIds, setMasteredIds] = useState(new Set()); // Keep track of current mastery state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionComplete, setSessionComplete] = useState(false);

  useEffect(() => {
    fetchSetData();
  }, [setId]);

  const fetchSetData = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:8000/api/flashcard-sets');
      const targetSet = res.data.find(s => s.id === parseInt(setId));
      if (!targetSet) {
        navigate('/dashboard');
        return;
      }
      setFlashcardSet(targetSet);
      setCards(targetSet.flashcards);
      
      const initialMastered = new Set();
      targetSet.flashcards.forEach(c => {
         if (c.is_mastered) initialMastered.add(c.id);
      });
      setMasteredIds(initialMastered);
      setLoading(false);
    } catch (err) {
      console.error(err);
      navigate('/dashboard');
    }
  };

  const handleProgress = async (mastered) => {
    const currentCard = cards[currentIndex];
    
    setMasteredIds(prev => {
        const next = new Set(prev);
        if (mastered) next.add(currentCard.id);
        else next.delete(currentCard.id);
        return next;
    });

    try {
      await axios.put(`http://127.0.0.1:8000/api/flashcard-sets/flashcards/${currentCard.id}/mastery`, {
        is_mastered: mastered
      });
    } catch (err) {
      console.error("Failed to sync progress", err);
    }

    if (currentIndex + 1 < cards.length) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(prev => prev + 1), 150);
    } else {
      setSessionComplete(true);
    }
  };

  const restartAll = () => {
    setCards(flashcardSet.flashcards);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionComplete(false);
  };

  const studyUnmastered = () => {
    const unmastered = flashcardSet.flashcards.filter(c => !masteredIds.has(c.id));
    if (unmastered.length === 0) {
      restartAll();
      return;
    }
    setCards(unmastered);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionComplete(false);
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
      <p className="mt-4 text-brand-muted">Loading Study Session...</p>
    </div>
  );

  if (sessionComplete) {
    const unmasteredCount = flashcardSet.flashcards.filter(c => !masteredIds.has(c.id)).length;
    
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }} 
          animate={{ opacity: 1, scale: 1 }} 
          className="glass-panel p-10 max-w-lg w-full text-center rounded-3xl border border-brand-border"
        >
          <BrainCircuit className="w-16 h-16 text-brand-primary mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-4">Session Complete!</h2>
          <p className="text-brand-muted mb-8 text-lg">
            You have mastered <strong className="text-brand-text">{masteredIds.size} / {flashcardSet.flashcards.length}</strong> cards in this set.
          </p>
          
          <div className="flex flex-col gap-4">
            {unmasteredCount > 0 && (
              <button 
                onClick={studyUnmastered} 
                className="w-full py-4 bg-brand-primary text-white rounded-xl shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:scale-[1.02] transition-all font-medium flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5" /> Study Unmastered Cards
              </button>
            )}
            <button 
              onClick={restartAll} 
              className="w-full py-4 bg-brand-surface border border-brand-border hover:bg-brand-primary/10 rounded-xl transition-all font-medium flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-5 h-5" /> Restart Entire Set
            </button>
            <button 
              onClick={() => navigate('/dashboard')} 
              className="mt-4 text-brand-muted hover:text-brand-text transition-all text-sm font-medium"
            >
              Back to Dashboard
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  return (
    <div className="min-h-screen flex flex-col items-center pt-8 px-4 w-full">
      <div className="w-full max-w-3xl flex justify-between items-center mb-8">
        <button 
          onClick={() => navigate('/dashboard')} 
          className="flex items-center gap-2 px-4 py-2 hover:bg-black/5 rounded-xl transition-all font-medium text-brand-muted hover:text-brand-text"
        >
          <ChevronLeft className="w-5 h-5" /> Dashboard
        </button>
        <div className="font-medium text-brand-muted px-4 py-2 bg-brand-surface border border-brand-border rounded-xl">
          Card {currentIndex + 1} of {cards.length}
        </div>
      </div>

      <div className="w-full max-w-3xl h-2 bg-brand-surface rounded-full overflow-hidden mb-12 border border-brand-border">
        <motion.div 
          className="h-full bg-brand-primary"
          initial={{ width: 0 }}
          animate={{ width: `${((currentIndex) / cards.length) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div 
          key={currentCard.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-3xl h-[400px] perspective-1000 relative"
        >
          <motion.div
            className="w-full h-full relative preserve-3d cursor-pointer"
            animate={{ rotateX: isFlipped ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            style={{ transformStyle: 'preserve-3d' }}
            onClick={() => setIsFlipped(!isFlipped)}
          >
            <div 
              className="absolute w-full h-full backface-hidden glass-panel rounded-3xl p-10 flex flex-col items-center justify-center text-center shadow-xl border border-brand-border hover:border-brand-primary/50 transition-all"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <div className="absolute top-6 left-6 px-3 py-1 bg-white/5 rounded-lg text-xs font-semibold tracking-wider text-brand-muted">
                QUESTION
              </div>
              <h2 className="text-3xl md:text-4xl font-medium leading-tight">{currentCard.question}</h2>
              <p className="absolute bottom-6 text-brand-muted animate-pulse font-medium">Click card to reveal answer</p>
            </div>

            <div 
              className="absolute w-full h-full backface-hidden rounded-3xl p-10 flex flex-col items-center justify-center text-center shadow-[0_0_30px_rgba(139,92,246,0.3)] border-2 border-brand-primary/50 bg-brand-surface"
              style={{ backfaceVisibility: 'hidden', transform: 'rotateX(180deg)' }}
            >
              <div className="absolute top-6 left-6 px-3 py-1 bg-brand-primary/20 rounded-lg text-xs font-semibold tracking-wider text-brand-primary">
                ANSWER
              </div>
              <p className="text-2xl md:text-3xl font-medium leading-relaxed">{currentCard.answer}</p>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      <motion.div 
        className="flex gap-4 mt-12 w-full max-w-xl h-16 relative"
      >
        <AnimatePresence>
          {isFlipped && (
             <motion.div 
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               className="w-full flex gap-4 absolute inset-0"
             >
              <button 
                onClick={() => handleProgress(false)}
                className="flex-1 py-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
              >
                <X className="w-5 h-5" /> Needs Review
              </button>
              <button 
                onClick={() => handleProgress(true)}
                className="flex-1 py-4 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
              >
                <Check className="w-5 h-5" /> Got It
              </button>
             </motion.div>
          )}
        </AnimatePresence>

        {!isFlipped && (
           <p className="text-brand-muted w-full text-center mt-4">
             Flip the card to track your progress
           </p>
        )}
      </motion.div>
    </div>
  );
}
