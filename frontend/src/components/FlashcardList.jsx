import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Flashcard from './Flashcard';
import { ArrowLeft, CheckCircle, BookOpen, Layers, CheckSquare, Edit3, HelpCircle, ExternalLink } from 'lucide-react';

export default function FlashcardList({ flashcards, setFlashcards, onReset, completeStudySet, savedSetId }) {
  const [activeTab, setActiveTab] = useState('flashcards');
  const navigate = useNavigate();

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

  const tabs = [
    { id: 'flashcards', label: 'Flashcards', icon: <Layers className="w-4 h-4" /> },
    { id: 'notes', label: 'Notes', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'true_false', label: 'True/False', icon: <CheckSquare className="w-4 h-4" /> },
    { id: 'fill_blanks', label: 'Fill in Blanks', icon: <Edit3 className="w-4 h-4" /> },
    { id: 'quiz', label: 'Quiz', icon: <HelpCircle className="w-4 h-4" /> },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full flex flex-col items-center"
    >
      <div className="w-full flex flex-col sm:flex-row items-center justify-between mb-6 max-w-5xl gap-4">
        <div className="flex gap-2">
           <button 
             onClick={onReset}
             className="flex items-center gap-2 text-brand-muted hover:text-brand-text transition-colors px-4 py-2 rounded-lg hover:bg-brand-surface border border-transparent hover:border-brand-border"
           >
             <ArrowLeft className="w-4 h-4" />
             Upload New PDF
           </button>
           {savedSetId && (
              <button 
                onClick={() => navigate(`/study/${savedSetId}`)}
                className="flex items-center gap-2 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary text-white font-bold transition-colors px-4 py-2 rounded-lg border border-brand-primary/20"
              >
                <ExternalLink className="w-4 h-4" />
                Launch Interactive Study
              </button>
           )}
        </div>
        <div className="flex flex-wrap gap-2 justify-center sm:justify-end">
          {tabs.map((tab) => (
             <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-brand-primary text-white shadow-lg'
                    : 'bg-brand-surface/50 text-brand-muted hover:text-brand-text hover:bg-brand-surface border border-brand-border/50'
                }`}
             >
                {tab.icon}
                {tab.label}
             </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* FLASHCARDS TAB */}
        {activeTab === 'flashcards' && (
          <motion.div
            key="flashcards"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full max-w-5xl"
          >
            <div className="w-full flex justify-end mb-4">
              <div className="flex items-center gap-2 text-sm font-medium text-brand-primary bg-brand-primary/10 border border-brand-primary/20 px-4 py-2 rounded-full">
                <CheckCircle className="w-4 h-4" />
                {flashcards.length} Cards Generated
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
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
        )}

        {/* NOTES TAB */}
        {activeTab === 'notes' && completeStudySet && (
          <motion.div
            key="notes"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full max-w-5xl glass-panel p-8 rounded-3xl border border-brand-border space-y-8"
          >
            {completeStudySet.summary && (
              <div>
                <h3 className="text-xl font-bold text-brand-primary mb-3">Summary</h3>
                <p className="text-brand-text leading-relaxed">{completeStudySet.summary}</p>
              </div>
            )}
            
            {completeStudySet.key_points?.length > 0 && (
              <div>
                <h3 className="text-xl font-bold text-brand-primary mb-3">Key Points</h3>
                <ul className="list-disc pl-6 space-y-2">
                  {completeStudySet.key_points.map((pt, i) => (
                    <li key={i} className="text-brand-text">{pt}</li>
                  ))}
                </ul>
              </div>
            )}

            {completeStudySet.definitions?.length > 0 && (
              <div>
                <h3 className="text-xl font-bold text-brand-primary mb-3">Definitions</h3>
                <div className="space-y-4">
                  {completeStudySet.definitions.map((def, i) => (
                    <div key={i} className="p-4 bg-brand-bg rounded-xl border border-brand-border">
                      <h4 className="font-semibold text-brand-text mb-1">{def.term}</h4>
                      <p className="text-brand-muted text-sm">{def.definition}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* TRUE/FALSE TAB */}
        {activeTab === 'true_false' && completeStudySet && (
          <motion.div
            key="true_false"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full max-w-5xl space-y-4"
          >
            {completeStudySet.true_false?.length > 0 ? (
              completeStudySet.true_false.map((tf, i) => (
                <div key={i} className="glass-panel p-6 rounded-2xl border border-brand-border text-left">
                  <div className="flex gap-4">
                    <div className="shrink-0">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-primary/20 text-brand-primary font-bold text-sm">
                        {i + 1}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-brand-text mb-3">{tf.statement}</h3>
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-surface rounded-lg border border-brand-border mb-3">
                        <span className="text-sm font-semibold text-brand-muted">Answer:</span>
                        <span className={`text-sm font-bold ${tf.answer ? 'text-green-500' : 'text-red-500'}`}>
                          {tf.answer ? 'True' : 'False'}
                        </span>
                      </div>
                      <p className="text-sm text-brand-muted border-t border-brand-border/50 pt-3">{tf.explanation}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-brand-muted glass-panel rounded-2xl">No true/false questions generated for this document.</div>
            )}
          </motion.div>
        )}

        {/* FILL IN THE BLANKS TAB */}
        {activeTab === 'fill_blanks' && completeStudySet && (
          <motion.div
            key="fill_blanks"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full max-w-5xl space-y-4"
          >
            {completeStudySet.fill_blanks?.length > 0 ? (
              completeStudySet.fill_blanks.map((fb, i) => (
                <div key={i} className="glass-panel p-6 rounded-2xl border border-brand-border text-left">
                  <div className="flex gap-4 items-center">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-primary/20 text-brand-primary font-bold text-sm shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-lg text-brand-text">
                        {fb.sentence.split('____').map((part, pIdx, arr) => (
                           <span key={pIdx}>
                             {part}
                             {pIdx < arr.length - 1 && (
                               <span className="inline-block px-3 py-0.5 mx-1 bg-brand-primary/10 border border-brand-primary/30 rounded text-brand-primary font-semibold">
                                 {fb.blank_word}
                               </span>
                             )}
                           </span>
                        ))}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
             <div className="p-8 text-center text-brand-muted glass-panel rounded-2xl">No fill in the blanks generated for this document.</div>
            )}
          </motion.div>
        )}

        {/* QUIZ TAB */}
        {activeTab === 'quiz' && completeStudySet && (
          <motion.div
            key="quiz"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full max-w-5xl space-y-6"
          >
             {completeStudySet.quiz?.length > 0 ? (
               completeStudySet.quiz.map((q, i) => (
                 <div key={i} className="glass-panel p-6 rounded-2xl border border-brand-border text-left">
                    <h3 className="text-lg font-bold text-brand-text mb-4">{i + 1}. {q.question}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                      {q.options.map((opt, oIdx) => {
                         const isCorrect = opt === q.correct_answer;
                         return (
                           <div key={oIdx} className={`px-4 py-3 rounded-xl border flex items-center gap-3 ${isCorrect ? 'bg-green-500/10 border-green-500/50' : 'bg-brand-bg border-brand-border'}`}>
                              <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${isCorrect ? 'bg-green-500 text-white' : 'bg-brand-surface text-brand-muted'}`}>
                                 {String.fromCharCode(65 + oIdx)}
                              </span>
                              <span className={`text-sm ${isCorrect ? 'text-green-500 font-medium' : 'text-brand-text'}`}>{opt}</span>
                           </div>
                         );
                      })}
                    </div>
                 </div>
               ))
             ) : (
               <div className="p-8 text-center text-brand-muted glass-panel rounded-2xl">No quiz questions generated for this document.</div>
             )}
          </motion.div>
        )}

      </AnimatePresence>
    </motion.div>
  );
}
