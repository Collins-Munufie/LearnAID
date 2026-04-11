import { useState } from 'react';
import { motion } from 'framer-motion';
import { Edit2, Trash2, Check, X } from 'lucide-react';

export default function Flashcard({ card, index, onDelete, onUpdate }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editQ, setEditQ] = useState(card.question);
  const [editA, setEditA] = useState(card.answer);

  const handleSave = (e) => {
    e.stopPropagation();
    onUpdate({ question: editQ, answer: editA });
    setIsEditing(false);
  };

  const handleCancel = (e) => {
    e.stopPropagation();
    setEditQ(card.question);
    setEditA(card.answer);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="relative w-full h-[300px] bg-brand-surface rounded-2xl p-6 flex flex-col shadow-lg border border-brand-primary">
        <label className="text-xs font-semibold text-brand-muted mb-1">Question</label>
        <textarea 
          value={editQ}
          onChange={e => setEditQ(e.target.value)}
          className="w-full bg-brand-bg border border-brand-border rounded p-2 mb-3 text-sm resize-none h-20 outline-none text-brand-text focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
        />
        <label className="text-xs font-semibold text-brand-primary mb-1">Answer</label>
        <textarea 
          value={editA}
          onChange={e => setEditA(e.target.value)}
          className="w-full bg-brand-bg border border-brand-border rounded p-2 mb-3 text-sm resize-none flex-1 outline-none text-brand-text focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
        />
        <div className="flex justify-end gap-2 mt-auto">
          <button onClick={handleCancel} className="p-2 border border-brand-border rounded-lg text-brand-muted hover:bg-brand-bg"><X className="w-4 h-4"/></button>
          <button onClick={handleSave} className="p-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-hover"><Check className="w-4 h-4"/></button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[300px] perspective-1000 group">
      {/* Top right floating actions (visible on hover) */}
      <div className="absolute -top-3 -right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-50">
        <button onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} className="p-2 bg-brand-surface border border-brand-border rounded-full shadow hover:text-brand-secondary"><Edit2 className="w-4 h-4"/></button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-2 bg-red-50 border border-red-200 rounded-full shadow hover:text-red-500 text-red-400"><Trash2 className="w-4 h-4"/></button>
      </div>

      <motion.div
        className="w-full h-full relative preserve-3d cursor-pointer"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0, rotateY: isFlipped ? 180 : 0 }}
        transition={{ 
          opacity: { duration: 0.5, delay: index * 0.1 },
          y: { duration: 0.5, delay: index * 0.1 },
          rotateY: { type: "spring", stiffness: 260, damping: 20 }
        }}
        style={{ transformStyle: 'preserve-3d' }}
        onClick={() => setIsFlipped(!isFlipped)}
      >
        {/* Front of the card */}
        <div 
          className="absolute w-full h-full backface-hidden glass-panel rounded-2xl p-6 flex flex-col items-center justify-center text-center shadow-lg hover:shadow-xl hover:border-brand-primary/50 transition-all border border-brand-border/80"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="absolute top-4 left-4 text-xs font-medium px-2 py-1 bg-brand-bg rounded text-brand-muted">
            Question {index + 1}
          </div>
          <p className="text-xl font-medium text-brand-text px-2 mt-4">{card.question}</p>
          <p className="absolute bottom-6 text-sm text-brand-muted animate-pulse">Click to flip</p>
        </div>

        {/* Back of the card */}
        <div 
          className="absolute w-full h-full backface-hidden rounded-2xl p-6 flex flex-col items-center justify-center text-center shadow-[0_0_20px_rgba(139,92,246,0.2)] border border-brand-primary/50 bg-brand-surface"
          style={{ 
            backfaceVisibility: 'hidden', 
            transform: 'rotateY(180deg)'
          }}
        >
          <div className="absolute top-4 left-4 text-xs font-medium px-2 py-1 bg-brand-primary/20 text-brand-primary rounded">
            Answer
          </div>
          <p className="text-lg text-brand-text px-2 mt-4">{card.answer}</p>
        </div>
      </motion.div>
    </div>
  );
}
