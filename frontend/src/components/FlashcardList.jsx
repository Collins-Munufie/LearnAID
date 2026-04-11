import { motion } from 'framer-motion';
import Flashcard from './Flashcard';
import { ArrowLeft, CheckCircle } from 'lucide-react';

export default function FlashcardList({ flashcards, setFlashcards, onReset }) {
  if (!flashcards || flashcards.length === 0) return null;

  const handleDelete = (index) => {
    const updated = flashcards.filter((_, i) => i !== index);
    setFlashcards(updated);
  };

  const handleUpdate = (index, updatedCard) => {
    const updated = [...flashcards];
    updated[index] = updatedCard;
    setFlashcards(updated);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full flex flex-col items-center"
    >
      <div className="w-full flex items-center justify-between mb-8 max-w-5xl">
        <button 
          onClick={onReset}
          className="flex items-center gap-2 text-brand-muted hover:text-brand-text transition-colors px-4 py-2 rounded-lg hover:bg-brand-surface border border-transparent hover:border-brand-border"
        >
          <ArrowLeft className="w-4 h-4" />
          Upload New PDF
        </button>
        <div className="flex items-center gap-2 text-sm font-medium text-brand-primary bg-brand-primary/10 border border-brand-primary/20 px-4 py-2 rounded-full">
          <CheckCircle className="w-4 h-4" />
          {flashcards.length} Cards Generated
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-5xl">
        {flashcards.map((card, idx) => (
          <Flashcard 
            key={idx} 
            card={card} 
            index={idx} 
            onDelete={() => handleDelete(idx)}
            onUpdate={(updatedCard) => handleUpdate(idx, updatedCard)}
          />
        ))}
      </div>
    </motion.div>
  );
}
