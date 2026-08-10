import { useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Check, X, RotateCcw, BrainCircuit, Play, Layers, CheckCircle2, Type, ArrowRight, Target, AlignLeft, BookOpen, Headphones, PlayCircle, PauseCircle, StopCircle, Hash, FileText, Award, Bot } from 'lucide-react';
import api, { getErrorMessage } from '../lib/api';
import StudyChat from './StudyChat';
import MockExam from './MockExam';
import SocraticTutorModal from './SocraticTutorModal';
import { useAuth } from '../context/AuthContext';

const MarkdownRenderer = lazy(() => import('./MarkdownRenderer'));


export default function StudyMode() {
  const { setId } = useParams();
  const navigate = useNavigate();
  
  const [flashcardSet, setFlashcardSet] = useState(null);
  const [cards, setCards] = useState([]); 
  const [masteryLevels, setMasteryLevels] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [sessionComplete, setSessionComplete] = useState(false);
  
  const [activeMode, setActiveMode] = useState('notes');
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [podcastVoice, setPodcastVoice] = useState('Conversational Mode');
  const [chatQuery, setChatQuery] = useState('');

  // Socratic Tutor State
  const [isTutorOpen, setIsTutorOpen] = useState(false);
  const [tutorQuestion, setTutorQuestion] = useState('');
  const [tutorAnswer, setTutorAnswer] = useState('');

  const { fetchUser } = useAuth(); // AuthContext to refresh stats

  // Sidebar List Index
  const [testIndex, setTestIndex] = useState(0);

  // Interactive Study States
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);

  const [fibAnswers, setFibAnswers] = useState({});
  const [fibSubmitted, setFibSubmitted] = useState(false);
  const [fibReveal, setFibReveal] = useState(false);

  const [tfAnswers, setTfAnswers] = useState({});
  const [tfRevealed, setTfRevealed] = useState(false);

  // Written Test State
  const [writtenAnswers, setWrittenAnswers] = useState({});
  const [writtenGrading, setWrittenGrading] = useState(null);
  const [isGrading, setIsGrading] = useState(false);

  const handleClearChatQuery = useCallback(() => {
    setChatQuery('');
  }, []);

  // Podcast State
  const [isPlaying, setIsPlaying] = useState(false);
  const synthRef = useRef(window.speechSynthesis);
  const isPlayingRef = useRef(false);
  const currentLineIndexRef = useRef(0);
  const scriptLinesRef = useRef([]);
  const utteranceRef = useRef(null);

  const fetchSetData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await api.get(`/api/flashcard-sets/${setId}`);
      const targetSet = res.data;
      setFlashcardSet(targetSet);

      const mLevels = {};
      targetSet.flashcards.forEach(c => {
         mLevels[c.id] = c.mastery_level || 0;
      });
      setMasteryLevels(mLevels);

      const sortedCards = [...targetSet.flashcards].sort((a,b) => {
         return (mLevels[a.id] || 0) - (mLevels[b.id] || 0);
      });
      setCards(sortedCards);
    } catch (err) {
      console.error(err);
      setLoadError(getErrorMessage(err, 'Unable to load this study session.'));
    } finally {
      setLoading(false);
    }
  }, [setId]);

  useEffect(() => {
    fetchSetData();
  }, [fetchSetData]);

  // Track study session time and activity
  useEffect(() => {
    const logSessionActivity = async () => {
      try {
        await api.put('/api/user-stats/activity');
        if (fetchUser) {
          fetchUser().catch(err => console.warn('Failed to refresh user after activity log:', err));
        }
      } catch (e) {
        console.error("Failed to log activity:", e);
      }
    };
    logSessionActivity();

    const intervalId = setInterval(async () => {
      try {
        await api.put('/api/user-stats/study-time', { seconds: 60 });
      } catch (err) {
        console.warn('Failed to log study time:', err);
      }
    }, 60000);

    return () => {
      clearInterval(intervalId);
    };
  }, [setId, fetchUser]);

  // Cleanup synth if page unmounts or active mode changes
  useEffect(() => {
    const synth = synthRef.current;
    if (activeMode !== 'podcast') {
       if (synth.speaking || isPlayingRef.current) {
         isPlayingRef.current = false;
         synth.cancel();
         setIsPlaying(false);
       }
    }
    setTestIndex(0);
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizScore(0);
    setFibAnswers({});
    setFibSubmitted(false);
    setFibReveal(false);
    setTfAnswers({});
    setTfRevealed(false);
    setIsFlipped(false);
    setWrittenAnswers({});
    setWrittenGrading(null);
    setIsGrading(false);

    
    return () => {
      isPlayingRef.current = false;
      synth.cancel();
    }
  }, [activeMode, cards]);

  const handleProgress = async (success) => {
    const currentCard = cards[currentIndex];
    const currentLevel = masteryLevels[currentCard.id] || 0;
    
    let nextLevel = currentLevel;
    if (success) {
      nextLevel = Math.min(3, currentLevel + 1);
    } else {
      nextLevel = 0; 
    }

    setMasteryLevels(prev => ({
        ...prev,
        [currentCard.id]: nextLevel
    }));

    try {
      await api.put(`/api/flashcard-sets/flashcards/${currentCard.id}/mastery`, {
        mastery_level: nextLevel
      });
      // Increment real-time studied cards tracker
      await api.put('/api/user-stats/studied');
      if (fetchUser) {
        fetchUser().catch(err => console.warn('Failed to refresh user after progress:', err));
      }
    } catch (err) {
      console.warn('Failed to persist card progress:', err);
    }

    if (currentIndex + 1 < cards.length) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(prev => prev + 1), 300);
    } else {
      setSessionComplete(true);
    }
  };

  const restartAll = () => {
    const sortedCards = [...flashcardSet.flashcards].sort((a,b) => {
       return (masteryLevels[a.id] || 0) - (masteryLevels[b.id] || 0);
    });
    setCards(sortedCards);
    setCurrentIndex(0);
    setTestIndex(0);
    setIsFlipped(false);
    setSessionComplete(false);
  };

  const studyUnmastered = () => {
    const unmastered = flashcardSet.flashcards.filter(c => (masteryLevels[c.id] || 0) < 3);
    if (unmastered.length === 0) {
      restartAll();
      return;
    }
    const sorted = [...unmastered].sort((a,b) => (masteryLevels[a.id] || 0) - (masteryLevels[b.id] || 0));
    setCards(sorted);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionComplete(false);
  };

  const getMasteryColor = (level) => {
    switch(level) {
      case 0: return 'bg-red-500/20 text-red-500'; 
      case 1: return 'bg-yellow-500/20 text-yellow-500'; 
      case 2: return 'bg-blue-500/20 text-blue-500';
      case 3: return 'bg-green-500/20 text-green-500'; 
      default: return 'bg-brand-surface text-brand-muted';
    }
  };

  const getMasteryLabel = (level) => {
    switch(level) {
      case 0: return 'Unfamiliar';
      case 1: return 'Learning';
      case 2: return 'Familiar';
      case 3: return 'Mastered';
      default: return 'Unknown';
    }
  };

  // ----- PODCAST LOGIC -----
  const speakNextLine = useCallback(() => {
    if (!isPlayingRef.current) return;
    const synth = synthRef.current;
    
    if (currentLineIndexRef.current >= scriptLinesRef.current.length) {
      setIsPlaying(false);
      isPlayingRef.current = false;
      return;
    }
    
    const line = scriptLinesRef.current[currentLineIndexRef.current];
    const utterance = new SpeechSynthesisUtterance(line.text);
    utteranceRef.current = utterance;
    
    const voices = synth.getVoices();
    let voice1, voice2;
    let pitch1 = 1, pitch2 = 1.1;
    let rate1 = 0.95, rate2 = 0.95;
    
    const findVoice = (keywords) => voices.find(v => keywords.some(k => v.name.toLowerCase().includes(k))) || voices.find(v => v.lang.includes("en")) || voices[0];
    
    if (podcastVoice === 'Warm Female Tutor') {
       voice1 = voice2 = findVoice(['female', 'samantha', 'zira', 'victoria', 'karen']);
       pitch1 = pitch2 = 1.15;
    } else if (podcastVoice === 'Deep Male Narrator') {
       voice1 = voice2 = findVoice(['male', 'david', 'alex', 'daniel', 'mark']);
       pitch1 = pitch2 = 0.8;
       rate1 = rate2 = 0.9;
    } else if (podcastVoice === 'Default AI Voice') {
       voice1 = voice2 = voices[0];
    } else {
       voice1 = findVoice(['female', 'samantha', 'zira']) || voices[0];
       voice2 = [...voices].reverse().find(v => v.name !== voice1?.name && v.lang.includes("en")) || voices[1] || voices[0];
       pitch1 = 1.1; pitch2 = 0.9;
    }
    
    if (podcastVoice === 'Conversational Mode') {
       utterance.voice = line.voice === 0 ? voice1 : voice2;
       utterance.pitch = line.voice === 0 ? pitch1 : pitch2;
       utterance.rate = line.voice === 0 ? rate1 : rate2;
    } else {
       utterance.voice = voice1;
       utterance.pitch = pitch1;
       utterance.rate = rate1;
    }
    
    utterance.onend = () => {
      currentLineIndexRef.current += 1;
      speakNextLine();
    };
    
    utterance.onerror = (e) => {
      console.warn("Speech synthesis error:", e);
      setIsPlaying(false);
      isPlayingRef.current = false;
    };
    
    synth.speak(utterance);
  }, [podcastVoice]);

  const togglePodcast = () => {
    const synth = synthRef.current;
    
    if (synth.speaking && !synth.paused && isPlaying) {
      synth.pause();
      setIsPlaying(false);
      isPlayingRef.current = false;
      return;
    }
    if (synth.paused) {
      synth.resume();
      setIsPlaying(true);
      isPlayingRef.current = true;
      return;
    }

    setIsPlaying(true);
    isPlayingRef.current = true;
    currentLineIndexRef.current = 0;
    
    const podcastScript = flashcardSet.podcast_script;
    const lines = [];

    if (podcastScript) {
      lines.push({ text: `Welcome to your Study Cast! Today's topic is: ${flashcardSet.title}. Let's dive right in.`, voice: 0 });
      const sentences = podcastScript.match(/[^.!?]+[.!?]+/g) || [podcastScript];
      sentences.forEach(sentence => {
        if (sentence.trim()) {
           lines.push({ text: sentence.trim(), voice: 1 });
        }
      });
      lines.push({ text: "That wraps up this episode. Keep studying and stay curious!", voice: 0 });
    } else {
      const summaryText = flashcardSet.summary || "No summary found.";
      const keyPointsArray = flashcardSet.key_points || [];
      lines.push({ text: `Welcome back to your Study Cast. Today we are focusing on: ${flashcardSet.title}. Let's jump in!`, voice: 0 });
      lines.push({ text: `Sounds great. Here is the executive overview: ${summaryText}`, voice: 1 });
      lines.push({ text: `Excellent. Now, let's go over the key concepts you need to memorize.`, voice: 0 });
      keyPointsArray.forEach((kp, i) => {
         lines.push({ text: `Key point number ${i+1}. ${kp}`, voice: i % 2 === 0 ? 1 : 0 });
      });
      lines.push({ text: "That wraps up this learning session. Good luck reviewing your flashcards!", voice: 0 });
    }

    scriptLinesRef.current = lines;
    speakNextLine();
  };

  const stopPodcast = () => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    synthRef.current.cancel();
  };
  // -------------------------

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
      <p className="mt-4 text-brand-muted">Loading Study Session...</p>
    </div>
  );

  if (loadError || !flashcardSet) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-bg px-4 text-center">
        <BrainCircuit className="w-12 h-12 text-brand-primary mb-4" />
        <h1 className="text-2xl font-bold mb-2 text-brand-text">Study session unavailable</h1>
        <p className="text-brand-muted max-w-md mb-6">{loadError || 'This study set could not be found.'}</p>
        <div className="flex gap-3">
          <button onClick={fetchSetData} className="px-5 py-3 rounded-xl bg-brand-primary text-white font-bold">
            Retry
          </button>
          <button onClick={() => navigate('/dashboard')} className="px-5 py-3 rounded-xl bg-brand-surface border border-brand-border text-brand-text font-bold">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const mCounts = {0: 0, 1: 0, 2: 0, 3: 0};
  Object.values(masteryLevels).forEach(l => mCounts[l]++);

  const summary = flashcardSet.summary || "No summary available for this set.";
  const keyPoints = flashcardSet.key_points || [];
  const quizList = flashcardSet.quiz || [];
  const blanksList = flashcardSet.fill_blanks || [];
  const shortList = flashcardSet.short_questions || [];
  const trueFalseList = flashcardSet.true_false || [];
  const definitionsList = flashcardSet.definitions || [];
  return (
    <div className="min-h-screen flex bg-brand-bg relative">
      {/* Simplified Mobile Sticky Header */}
      <div className="fixed top-0 left-0 right-0 h-14 z-20 flex items-center justify-between bg-brand-surface/95 backdrop-blur-md border-b border-brand-border md:hidden px-4">
        <button onClick={() => navigate('/dashboard')} className="p-3 -ml-2 text-brand-muted hover:text-brand-text flex items-center justify-center rounded-xl min-w-[44px] min-h-[44px] active:scale-90 transition-all" aria-label="Go Back">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <span className="font-bold text-brand-text text-sm sm:text-base truncate max-w-[70%] text-center">
          {flashcardSet?.title}
        </span>
        <div className="w-10"></div> {/* Balanced layout spacer */}
      </div>

      <aside className="w-64 fixed left-0 top-0 h-screen border-r border-brand-border bg-brand-surface pt-8 p-4 flex flex-col hidden md:flex z-10 overflow-y-auto">
         <div className="flex items-center gap-2 mb-8 cursor-pointer" onClick={() => navigate('/dashboard')}>
           <ChevronLeft className="w-5 h-5 text-brand-muted" />
           <span className="font-semibold text-brand-text">Dash</span>
         </div>

         <div className="flex flex-col gap-2 flex-1">
           <h4 className="text-xs font-bold text-brand-muted uppercase tracking-wider mb-2">Study Modes</h4>
           
           <button onClick={() => setActiveMode('notes')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-left ${activeMode === 'notes' ? 'bg-brand-primary/10 text-brand-primary font-bold shadow-sm border border-brand-primary/20' : 'text-brand-muted hover:bg-black/5'}`}>
             <AlignLeft className="w-5 h-5 shrink-0" /> <span>Notes</span>
           </button>
           <button onClick={() => setActiveMode('mock_exam')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-left ${activeMode === 'mock_exam' ? 'bg-brand-primary/10 text-brand-primary font-bold shadow-sm border border-brand-primary/20' : 'text-brand-muted hover:bg-black/5'}`}>
             <Award className="w-5 h-5 shrink-0" /> <span>AI Mock Exam</span>
           </button>
           {quizList.length > 0 && (
             <button onClick={() => setActiveMode('multiple_choice')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-left ${activeMode === 'multiple_choice' ? 'bg-brand-primary/10 text-brand-primary font-bold shadow-sm border border-brand-primary/20' : 'text-brand-muted hover:bg-black/5'}`}>
               <Target className="w-5 h-5 shrink-0" /> <span>Multiple Choice</span>
             </button>
           )}
           <button onClick={() => setActiveMode('flashcards')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-left ${activeMode === 'flashcards' ? 'bg-brand-primary/10 text-brand-primary font-bold shadow-sm border border-brand-primary/20' : 'text-brand-muted hover:bg-black/5'}`}>
             <Layers className="w-5 h-5 shrink-0" /> <span>Flashcards</span>
           </button>
           <button onClick={() => setActiveMode('podcast')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-left ${activeMode === 'podcast' ? 'bg-brand-primary/10 text-brand-primary font-bold shadow-sm border border-brand-primary/20' : 'text-brand-muted hover:bg-black/5'}`}>
             <Headphones className="w-5 h-5 shrink-0" /> <span>Podcast</span>
           </button>
           {blanksList.length > 0 && (
             <button onClick={() => setActiveMode('fill_blanks')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-left ${activeMode === 'fill_blanks' ? 'bg-brand-primary/10 text-brand-primary font-bold shadow-sm border border-brand-primary/20' : 'text-brand-muted hover:bg-black/5'}`}>
               <Type className="w-5 h-5 shrink-0" /> <span>Fill-in-the-Blank</span>
             </button>
           )}
           {shortList.length > 0 && (
             <button onClick={() => setActiveMode('written_test')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-left ${activeMode === 'written_test' ? 'bg-brand-primary/10 text-brand-primary font-bold shadow-sm border border-brand-primary/20' : 'text-brand-muted hover:bg-black/5'}`}>
               <BookOpen className="w-5 h-5 shrink-0" /> <span>Written Test</span>
             </button>
           )}
           {trueFalseList.length > 0 && (
             <button onClick={() => setActiveMode('true_false')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-left ${activeMode === 'true_false' ? 'bg-brand-primary/10 text-brand-primary font-bold shadow-sm border border-brand-primary/20' : 'text-brand-muted hover:bg-black/5'}`}>
               <CheckCircle2 className="w-5 h-5 shrink-0" /> <span>True / False</span>
             </button>
           )}
           {flashcardSet?.tutor_lesson && (
             <button onClick={() => setActiveMode('tutor_lesson')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-left ${activeMode === 'tutor_lesson' ? 'bg-brand-primary/10 text-brand-primary font-bold shadow-sm border border-brand-primary/20' : 'text-brand-muted hover:bg-black/5'}`}>
               <BrainCircuit className="w-5 h-5 shrink-0" /> <span>Tutor Lesson</span>
             </button>
           )}
           {definitionsList.length > 0 && (
             <button onClick={() => setActiveMode('definitions')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-left ${activeMode === 'definitions' ? 'bg-brand-primary/10 text-brand-primary font-bold shadow-sm border border-brand-primary/20' : 'text-brand-muted hover:bg-black/5'}`}>
               <BookOpen className="w-5 h-5 shrink-0" /> <span>Definitions</span>
             </button>
           )}
           {flashcardSet?.raw_content && (
             <button onClick={() => setActiveMode('content')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-left ${activeMode === 'content' ? 'bg-brand-primary/10 text-brand-primary font-bold shadow-sm border border-brand-primary/20' : 'text-brand-muted hover:bg-black/5'}`}>
               <AlignLeft className="w-5 h-5 shrink-0" /> <span>Content</span>
             </button>
           )}
         </div>
      </aside>

      <main className="flex-1 md:pl-64 lg:pr-96 flex flex-col items-center pt-20 pb-24 md:pt-8 md:pb-8 px-4 relative min-h-screen">
         <div className="w-full max-w-4xl flex flex-col md:flex-row justify-between items-center mb-8 gap-4 px-4">
           <div className="flex flex-wrap gap-2 justify-center">
            {[0,1,2,3].map(level => (
              <div key={level} className={`px-3 py-1 text-xs font-bold rounded-full ${getMasteryColor(level)}`}>
                {mCounts[level]} {getMasteryLabel(level)}
              </div>
            ))}
          </div>
          
          <div className="font-medium text-brand-muted px-4 py-2 bg-brand-surface border border-brand-border rounded-xl whitespace-nowrap">
            {activeMode === 'podcast' && `AI Audio Playback`}
            {activeMode === 'flashcards' && `Card ${currentIndex + 1} of ${cards.length}`}
            {activeMode === 'multiple_choice' && `Quiz ${testIndex + 1} of ${quizList.length}`}
            {activeMode === 'fill_blanks' && `Blank ${testIndex + 1} of ${blanksList.length}`}
            {activeMode === 'written_test' && `${shortList.length} Practice Questions`}
            {activeMode === 'tutor_lesson' && `Learning Module`}
            {activeMode === 'definitions' && `Definition Library`}
            {activeMode === 'content' && `Raw Data Source`}
            {activeMode === 'mock_exam' && `Simulated Examination`}
          </div>
        </div>

        {['flashcards', 'multiple_choice', 'fill_blanks'].includes(activeMode) && (
          <div className="w-full max-w-4xl h-2 bg-brand-surface rounded-full overflow-hidden mb-8 border border-brand-border">
            <motion.div 
              className="h-full bg-brand-primary"
              initial={{ width: 0 }}
              animate={{ 
                 width: activeMode === 'flashcards' ? `${((currentIndex) / cards.length) * 100}%` :
                        activeMode === 'multiple_choice' && quizList.length > 0 ? `${((testIndex) / quizList.length) * 100}%` : 
                        activeMode === 'fill_blanks' && blanksList.length > 0 ? `${((testIndex) / blanksList.length) * 100}%` : '0%'
              }}
              transition={{ duration: 0.3 }}
            />
          </div>
        )}

        {(sessionComplete && activeMode === 'flashcards') || 
         (activeMode === 'multiple_choice' && testIndex >= quizList.length && quizList.length > 0) || 
         (activeMode === 'fill_blanks' && testIndex >= blanksList.length && blanksList.length > 0) ? (
           <div className="w-full flex-1 flex flex-col items-center justify-center">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }} 
              className="glass-panel p-10 max-w-lg w-full text-center rounded-3xl border border-brand-border shadow-xl"
            >
              <BrainCircuit className="w-16 h-16 text-brand-primary mx-auto mb-6" />
              <h2 className="text-3xl font-bold mb-4">You did it!</h2>
              {activeMode === 'flashcards' && (
                <p className="text-brand-muted mb-8 text-lg">
                  You currently have <strong className="text-green-500">{mCounts[3]}</strong> cards fully mastered.
                </p>
              )}
              
              <div className="flex flex-col gap-4 w-full">
                {activeMode === 'flashcards' && mCounts[3] < flashcardSet.flashcards.length && (
                  <button 
                    onClick={studyUnmastered} 
                    className="w-full py-4 bg-brand-primary text-white rounded-xl shadow-[0_0_15px_rgba(139,92,246,0.3)] md:hover:scale-[1.02] active:scale-95 transition-all font-medium flex items-center justify-center gap-2 min-h-[48px]"
                  >
                    <Play className="w-5 h-5" /> Prioritize Weak Topics
                  </button>
                )}
                <button 
                  onClick={restartAll} 
                  className="w-full py-4 bg-brand-surface border border-brand-border hover:bg-brand-primary/10 rounded-xl transition-all md:hover:scale-[1.02] active:scale-95 font-medium flex items-center justify-center gap-2 min-h-[48px]"
                >
                  <RotateCcw className="w-5 h-5" /> Start Over
                </button>
              </div>
            </motion.div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div 
              key={activeMode + (activeMode==='flashcards'?currentIndex:testIndex)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-4xl flex-1 flex flex-col items-center pb-20 mt-4" 
            >
              
              {/* PODCAST MODE */}
              {activeMode === 'podcast' && (
                <div className="w-full max-w-2xl text-center space-y-8 flex flex-col items-center justify-center pt-10">
                   <div className="w-32 h-32 rounded-full border-4 border-brand-primary/30 flex items-center justify-center relative bg-brand-surface shadow-[0_0_50px_rgba(139,92,246,0.2)]">
                     <Headphones className={`w-16 h-16 ${isPlaying ? 'text-brand-primary' : 'text-brand-muted'}`} />
                     {isPlaying && (
                       <>
                         <motion.div className="absolute inset-0 rounded-full border-2 border-brand-primary" animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }} transition={{ duration: 2, repeat: Infinity }} />
                         <motion.div className="absolute inset-0 rounded-full border-2 border-brand-primary" animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }} transition={{ duration: 2, delay: 0.5, repeat: Infinity }} />
                       </>
                     )}
                   </div>
                   
                   <div>
                     <h2 className="text-3xl font-bold text-brand-text mb-2">Study Cast</h2>
                     <p className="text-brand-muted text-lg">{flashcardSet.title}</p>
                     <p className="text-sm text-brand-muted mt-2 opacity-70">A highly engaging, conversational AI playback.</p>
                   </div>

                   <div className="flex flex-col items-center gap-6">
                     <div className="flex items-center gap-3">
                       <label className="text-brand-muted font-medium">Voice Style:</label>
                       <select 
                         value={podcastVoice}
                         onChange={(e) => {
                           setPodcastVoice(e.target.value);
                           if(isPlaying) stopPodcast(); // Stop if playing to apply new voice
                         }}
                         className="bg-brand-surface border border-brand-border text-brand-text px-4 py-2 rounded-xl focus:outline-none focus:border-brand-primary cursor-pointer"
                       >
                         <option value="Conversational Mode">Conversational Mode (2 Hosts)</option>
                         <option value="Warm Female Tutor">Warm Female Tutor</option>
                         <option value="Deep Male Narrator">Deep Male Narrator</option>
                         <option value="Default AI Voice">Default AI Voice</option>
                       </select>
                     </div>

                      <div className="flex gap-4 w-full flex-col sm:flex-row justify-center">
                        <button 
                          onClick={togglePodcast} 
                          className="px-8 py-4 bg-brand-primary text-white rounded-2xl font-bold shadow-lg md:hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 text-lg min-h-[48px]"
                        >
                          {isPlaying ? <><PauseCircle className="w-6 h-6"/> Pause</> : <><PlayCircle className="w-6 h-6"/> Listen to Podcast</>}
                        </button>
                        {isPlaying && (
                          <button 
                            onClick={stopPodcast} 
                            className="px-6 py-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl font-bold md:hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 text-lg min-h-[48px]"
                          >
                            <StopCircle className="w-6 h-6"/> Stop
                          </button>
                        )}
                      </div>
                   </div>
                </div>
              )}

              {/* AI MOCK EXAM MODE */}
              {activeMode === 'mock_exam' && (
                <MockExam 
                  setId={setId} 
                  flashcardSet={flashcardSet} 
                  onSwitchMode={(mode, initialMessage) => {
                    if (mode === 'chat') {
                      setChatQuery(initialMessage);
                      setMobileChatOpen(true);
                    } else {
                      setActiveMode(mode);
                    }
                  }} 
                />
              )}

              {/* NOTES MODE */}
              {activeMode === 'notes' && (
                 <div className="w-full text-left space-y-6">
                    <div className="glass-panel p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-brand-border shadow-lg">
                      <Suspense fallback={<div className="h-40 w-full bg-brand-surface animate-pulse border border-brand-border rounded-3xl" />}>
                        <MarkdownRenderer content={summary} mode="notes" />
                      </Suspense>
                    </div>
                   {keyPoints.length > 0 && (
                     <div className="glass-panel p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-brand-border shadow-lg">
                       <h2 className="text-xl sm:text-2xl font-bold text-brand-text mb-6">Key Concepts</h2>
                       <ul className="space-y-4">
                         {keyPoints.map((kp, i) => (
                            <li key={i} className="flex gap-4 items-start">
                              <div className="w-6 h-6 mt-1 rounded-full bg-brand-primary/20 text-brand-primary flex items-center justify-center font-bold text-xs shrink-0">{i+1}</div>
                              <span className="text-brand-muted text-lg leading-relaxed">{kp}</span>
                            </li>
                         ))}
                       </ul>
                     </div>
                   )}
                </div>
              )}

              {/* FLASHCARDS MODE */}
              {activeMode === 'flashcards' && (
                <>
                  {!cards || cards.length === 0 ? (
                     <div className="w-full max-w-3xl glass-panel p-10 rounded-3xl text-center text-brand-muted mt-8">
                       <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
                       <h2 className="text-xl font-medium">No active flashcards.</h2>
                       <p>You have mastered or deleted all flashcards in this set.</p>
                     </div>
                  ) : cards[currentIndex] && (
                    <>
                  <div className="mb-4">
                    <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${getMasteryColor(masteryLevels[cards[currentIndex].id]||0)}`}>
                      <Target className="w-4 h-4" /> {getMasteryLabel(masteryLevels[cards[currentIndex].id]||0)}
                    </span>
                  </div>
                  <div className="w-full h-[280px] sm:h-[400px] perspective-1000 relative max-w-3xl">
                    <motion.div
                      className="w-full h-full relative preserve-3d cursor-pointer"
                      animate={{ rotateX: isFlipped ? 180 : 0 }}
                      transition={{ type: "spring", stiffness: 260, damping: 20 }}
                      style={{ transformStyle: 'preserve-3d' }}
                      onClick={() => setIsFlipped(!isFlipped)}
                    >
                      <div 
                        className="absolute w-full h-full backface-hidden glass-panel rounded-3xl p-6 sm:p-10 flex flex-col items-center justify-center text-center shadow-xl border border-brand-border hover:border-brand-primary/50 transition-all"
                        style={{ backfaceVisibility: 'hidden' }}
                      >
                        <h2 className="text-2xl sm:text-3xl md:text-4xl font-medium leading-tight text-brand-text px-4">{cards[currentIndex].question}</h2>
                        <p className="absolute bottom-6 text-brand-muted animate-pulse font-medium text-sm">Click card to reveal</p>
                      </div>

                      <div 
                        className="absolute w-full h-full backface-hidden rounded-3xl p-6 sm:p-10 flex flex-col items-center justify-center text-center shadow-[0_0_30px_rgba(139,92,246,0.2)] border-2 border-brand-primary/50 bg-brand-surface"
                        style={{ backfaceVisibility: 'hidden', transform: 'rotateX(180deg)' }}
                      >
                        <p className="text-lg sm:text-xl md:text-2xl font-medium leading-relaxed text-brand-text px-4">{cards[currentIndex].answer}</p>
                      </div>
                    </motion.div>
                  </div>
                  
                  <motion.div className="flex gap-4 mt-8 w-full h-16 relative justify-center max-w-3xl">
                    <AnimatePresence>
                      {isFlipped && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="w-full flex gap-4 absolute inset-0"
                        >
                          <button 
                            onClick={() => handleProgress(false)}
                            className="flex-1 py-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-500 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95"
                          >
                            <X className="w-5 h-5" /> Needs Review
                          </button>
                          <button
                            onClick={() => {
                              setTutorQuestion(cards[currentIndex].question);
                              setTutorAnswer(cards[currentIndex].answer);
                              setIsTutorOpen(true);
                            }}
                            className="flex-1 py-4 bg-brand-primary/10 hover:bg-brand-primary/20 border border-brand-primary/30 text-brand-primary rounded-2xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95"
                          >
                            <Bot className="w-5 h-5" /> Tutor Me
                          </button>
                          <button 
                            onClick={() => handleProgress(true)}
                            className="flex-1 py-4 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-500 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95"
                          >
                            <Check className="w-5 h-5" /> Got It
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </>
              )}
            </>
          )}
              {/* MULTIPLE CHOICE MODE */}
              {activeMode === 'multiple_choice' && quizList.length > 0 && (
                <div className="w-full max-w-4xl flex flex-col gap-8">
                  {quizList.map((q, qIndex) => (
                    <div key={qIndex} className="glass-panel p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-brand-border shadow-lg">
                      <h2 className="text-lg sm:text-xl md:text-2xl font-medium mb-6 text-brand-text flex items-start gap-4 break-words">
                         <span className="w-10 h-10 rounded-xl bg-brand-primary/20 text-brand-primary flex items-center justify-center font-bold text-sm shrink-0 shadow-inner mt-0.5">Q{qIndex + 1}</span> 
                         <span className="leading-relaxed mt-1 break-words">{q.question}</span>
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {q.options.map((opt, i) => {
                           const isCorrect = opt === q.correct_answer;
                           const isSelected = quizAnswers[qIndex] === opt;
                           const displayState = quizSubmitted ? (isCorrect ? 'correct' : (isSelected ? 'incorrect' : 'faded')) : (isSelected ? 'selected' : 'default');
                           
                           let classes = 'bg-brand-surface border-brand-border hover:border-brand-primary/50 hover:bg-brand-primary/5';
                           if (displayState === 'selected') classes = 'bg-brand-primary/20 border-brand-primary/50 border-2';
                           if (displayState === 'correct') classes = 'bg-green-500/20 border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.3)] text-green-400 border-2 text-left';
                           if (displayState === 'incorrect') classes = 'bg-red-500/20 border-red-500/50 text-red-400 border-2 text-left';
                           if (displayState === 'faded') classes = 'opacity-40 border-brand-border bg-brand-bg grayscale';

                           return (
                             <button 
                                key={i}
                                onClick={() => {
                                  if (quizSubmitted) return;
                                  setQuizAnswers({...quizAnswers, [qIndex]: opt});
                                }}
                                className={`p-4 rounded-2xl border text-left transition-all ${classes}`}
                             >
                               <div className="flex items-start gap-4">
                                 <div className="w-10 h-10 rounded-xl bg-black/10 flex items-center justify-center font-bold text-sm shrink-0 shadow-inner mt-0.5">{String.fromCharCode(65+i)}</div>
                                 <p className="font-medium flex-1 break-words leading-relaxed mt-1">{opt}</p>
                               </div>
                             </button>
                           )
                        })}
                      </div>

                      {quizSubmitted && quizAnswers[qIndex] !== q.correct_answer && (
                        <div className="mt-6 flex justify-end">
                           <button
                             onClick={() => {
                               setTutorQuestion(q.question);
                               setTutorAnswer(q.correct_answer);
                               setIsTutorOpen(true);
                             }}
                             className="px-4 py-2 bg-brand-primary/10 hover:bg-brand-primary/20 border border-brand-primary/30 text-brand-primary rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95 min-h-[44px]"
                           >
                             <Bot className="w-4 h-4" /> Get AI Help
                           </button>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  <div className="flex justify-center mt-4 mb-10">
                    {!quizSubmitted ? (
                      <button 
                        onClick={async () => {
                           setQuizSubmitted(true);
                           let score = 0;
                           quizList.forEach((q, i) => { if(quizAnswers[i] === q.correct_answer) score++; });
                           setQuizScore(score);
                           try {
                             await api.put('/api/user-stats/quiz');
                             await api.put('/api/user-stats/accuracy', {
                                type: 'quiz', accuracy: Math.round(score/quizList.length * 100)
                             });
                             if(fetchUser) {
                               fetchUser().catch(err => console.warn('Failed to refresh user after quiz:', err));
                             }
                           } catch(err) {
                             console.warn('Failed to persist quiz stats:', err);
                           }
                        }}
                        disabled={Object.keys(quizAnswers).length < quizList.length}
                        className="px-8 py-4 bg-brand-primary text-white rounded-2xl font-bold shadow-lg md:hover:scale-105 active:scale-95 transition-all text-lg disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed min-h-[48px]"
                      >
                         Submit Quiz
                      </button>
                    ) : (
                      <div className="flex flex-col items-center gap-4 w-full max-w-sm">
                        <div className="text-xl sm:text-2xl font-bold p-5 sm:p-6 w-full glass-panel rounded-3xl border border-brand-border flex items-center justify-center gap-4 text-brand-text">
                          Score: <span className={quizScore === quizList.length ? 'text-green-500' : 'text-brand-primary'}>{quizScore} / {quizList.length} ({Math.round(quizScore/quizList.length * 100)}%)</span>
                        </div>
                        <button 
                          onClick={() => { setQuizSubmitted(false); setQuizAnswers({}); setQuizScore(0); }}
                          className="w-full py-4 bg-brand-surface border border-brand-border md:hover:bg-brand-primary/10 active:scale-95 text-brand-text rounded-2xl font-bold transition-all text-lg flex items-center justify-center gap-2 min-h-[48px]"
                        >
                           <RotateCcw className="w-5 h-5"/> Retry Quiz
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* FILL IN THE BLANKS MODE */}
              {activeMode === 'fill_blanks' && blanksList.length > 0 && (
                <div className="w-full max-w-4xl flex flex-col gap-6">
                  {blanksList.map((blank, index) => {
                     const val = fibAnswers[index] || '';
                     const isCorrect = val.toLowerCase().trim() === blank.blank_word.toLowerCase().trim();
                     return (
                        <div key={index} className="text-lg sm:text-xl leading-relaxed font-medium bg-brand-surface p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-brand-border shadow-md text-brand-text text-left break-words">
                           <span className="text-brand-primary mr-3 font-bold">{index + 1}.</span>
                           {blank.sentence.split('____').map((segment, i, arr) => {
                              if (i < arr.length - 1) {
                                 return (
                                    <span key={i}>
                                       {segment}
                                       <span className="relative inline-flex flex-col">
                                         <input 
                                            type="text"
                                            value={fibReveal ? blank.blank_word : val}
                                            onChange={(e) => setFibAnswers({...fibAnswers, [index]: e.target.value})}
                                            disabled={fibSubmitted || fibReveal}
                                            className={`mx-2 text-center border-b-2 bg-transparent outline-none w-32 md:w-48 transition-colors ${
                                               fibReveal ? 'border-green-500 text-green-500 opacity-100 font-bold bg-green-500/10 rounded-t px-2' :
                                               fibSubmitted ? (isCorrect ? 'border-green-500 text-green-500 font-bold bg-green-500/10 rounded-t px-2' : 'border-red-500 text-red-500 line-through bg-red-500/10 rounded-t px-2') :
                                               'border-brand-primary focus:border-brand-primary-hover focus:bg-brand-primary/5 rounded-t px-2 text-brand-primary'
                                            }`} 
                                         />
                                         {fibSubmitted && !isCorrect && !fibReveal && (
                                            <div className="absolute top-full left-0 w-full text-center mt-1 z-10">
                                               <span className="text-sm bg-brand-surface border border-green-500/50 text-green-500 px-2 rounded-md shadow-lg">{blank.blank_word}</span>
                                            </div>
                                         )}
                                       </span>
                                    </span>
                                 )
                              }
                              return <span key={i}>{segment}</span>
                           })}
                        </div>
                     )
                  })}
                  <div className="flex justify-center gap-4 mt-6 mb-10">
                     {!fibSubmitted && !fibReveal && (
                        <button 
                           onClick={async () => {
                              setFibSubmitted(true);
                              let score = 0;
                              blanksList.forEach((b, i) => {
                                 if ((fibAnswers[i]||'').toLowerCase().trim() === b.blank_word.toLowerCase().trim()) score++;
                              });
                              try {
                                 await api.put('/api/user-stats/accuracy', {
                                    type: 'fill_blank', accuracy: Math.round(score/blanksList.length * 100)
                                 });
                                 if(fetchUser) {
                                   fetchUser().catch(err => console.warn('Failed to refresh user after fill blanks:', err));
                                 }
                              } catch(err) {
                                 console.warn('Failed to persist fill-in-the-blank stats:', err);
                              }
                           }}
                           className="px-8 py-4 bg-brand-primary text-white rounded-2xl font-bold shadow-lg md:hover:scale-105 active:scale-95 transition-all text-lg min-h-[48px]"
                        >
                           Check Answers
                        </button>
                     )}
                     <button 
                        onClick={() => setFibReveal(!fibReveal)}
                        className={`px-8 py-4 rounded-2xl font-bold transition-all text-lg border md:hover:scale-105 active:scale-95 ${fibReveal ? 'bg-brand-surface text-brand-muted border-brand-border' : 'bg-brand-surface border-brand-primary/30 text-brand-primary md:hover:bg-brand-primary/10'} min-h-[48px]`}
                     >
                        {fibReveal ? 'Hide Answers' : 'Show All Answers'}
                     </button>
                     {(fibSubmitted || fibReveal) && (
                        <button 
                           onClick={() => { setFibSubmitted(false); setFibAnswers({}); setFibReveal(false); }}
                           className="px-8 py-4 bg-brand-surface md:hover:bg-brand-bg active:scale-95 border border-brand-border text-brand-text rounded-2xl font-bold transition-all text-lg flex items-center justify-center gap-2 min-h-[48px]"
                        >
                           <RotateCcw className="w-5 h-5"/> Retry
                        </button>
                     )}
                  </div>
                </div>
              )}
              
              {/* TRUE / FALSE MODE */}
              {activeMode === 'true_false' && trueFalseList.length > 0 && (
                <div className="w-full max-w-4xl flex flex-col gap-6">
                   {trueFalseList.map((tf, index) => {
                       const selected = tfAnswers[index];
                       const isCorrect = selected === tf.answer;
                       return (
                          <div key={index} className="flex flex-col md:flex-row gap-4 sm:gap-6 bg-brand-surface p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-brand-border shadow-md text-brand-text items-center md:items-start w-full break-words">
                             <div className="flex-1 text-left w-full">
                                <h3 className="text-lg sm:text-xl font-medium mb-3 break-words"><span className="text-brand-primary font-bold mr-2">{index + 1}.</span> {tf.statement}</h3>
                                {tfRevealed && (
                                   <div className={`mt-4 p-4 rounded-xl border text-sm flex flex-col gap-1 ${isCorrect || selected === undefined ? 'bg-green-500/10 border-green-500/30 text-green-500' : 'bg-red-500/10 border-red-500/30 text-red-500'}`}>
                                      <span className="font-bold">{tf.answer ? 'True' : 'False'} is correct.</span>
                                      <span className="text-brand-text/80 opacity-80">{tf.explanation}</span>
                                   </div>
                                )}
                             </div>
                             <div className="flex shrink-0 gap-3 w-full justify-center md:justify-end md:w-auto">
                                <button 
                                  disabled={tfRevealed}
                                  onClick={() => setTfAnswers({...tfAnswers, [index]: true})}
                                  className={`px-8 py-3 rounded-xl font-bold border transition-all flex-1 md:flex-none ${
                                     tfRevealed ? (tf.answer === true ? 'bg-green-500 text-white border-green-500 shadow-lg' : (selected === true ? 'bg-red-500 text-white border-red-500 opacity-50' : 'bg-brand-bg opacity-30 border-brand-border')) :
                                     (selected === true ? 'bg-brand-primary text-white border-brand-primary scale-105 shadow-md' : 'bg-brand-bg text-brand-text border-brand-border hover:border-brand-primary/50')
                                  }`}
                                >
                                  True
                                </button>
                                <button 
                                  disabled={tfRevealed}
                                  onClick={() => setTfAnswers({...tfAnswers, [index]: false})}
                                  className={`px-8 py-3 rounded-xl font-bold border transition-all flex-1 md:flex-none ${
                                     tfRevealed ? (tf.answer === false ? 'bg-green-500 text-white border-green-500 shadow-lg' : (selected === false ? 'bg-red-500 text-white border-red-500 opacity-50' : 'bg-brand-bg opacity-30 border-brand-border')) :
                                     (selected === false ? 'bg-brand-primary text-white border-brand-primary scale-105 shadow-md' : 'bg-brand-bg text-brand-text border-brand-border hover:border-brand-primary/50')
                                  }`}
                                >
                                  False
                                </button>
                             </div>
                          </div>
                       )
                   })}
                   <div className="flex justify-center mt-4 mb-10">
                      <button 
                        onClick={async () => { 
                           setTfRevealed(!tfRevealed); 
                           if(!tfRevealed) {
                              let score = 0;
                              trueFalseList.forEach((t, i) => { if (tfAnswers[i] === t.answer) score++; });
                              try {
                                 await api.put('/api/user-stats/accuracy', {
                                    type: 'true_false', accuracy: Math.round(score/trueFalseList.length * 100)
                                 });
                                 if(fetchUser) {
                                   fetchUser().catch(err => console.warn('Failed to refresh user after true/false:', err));
                                 }
                              } catch(err) {
                                 console.warn('Failed to persist true/false stats:', err);
                              }
                           } else {
                              if(fetchUser) {
                                fetchUser().catch(err => console.warn('Failed to refresh user after true/false hide:', err));
                              }
                           }
                        }}
                        className="px-8 py-4 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-2xl font-bold shadow-[0_0_15px_rgba(139,92,246,0.3)] transition-all text-lg flex items-center gap-2"
                      >
                         {tfRevealed ? 'Hide Answers' : 'Reveal Answers'}
                      </button>
                   </div>
                </div>
              )}

              {/* WRITTEN TEST MODE */}
              {activeMode === 'written_test' && (
                <div className="w-full text-left space-y-6">
                   <div className="glass-panel p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-brand-border shadow-lg">
                     <h2 className="text-xl sm:text-2xl font-bold text-brand-text mb-6">Written Test</h2>
                     {writtenGrading ? (
                        <div className="space-y-8">
                           <div className="p-6 bg-brand-primary/10 border border-brand-primary/30 rounded-2xl flex items-center justify-between">
                              <div>
                                 <h3 className="text-xl font-bold text-brand-text">AI Evaluation Complete</h3>
                                 <p className="text-brand-muted mt-1">Review your feedback below</p>
                              </div>
                              <div className="text-4xl font-black text-brand-primary">{writtenGrading.score}%</div>
                           </div>
                           
                            {writtenGrading.evaluations?.map((evalItem, idx) => (
                              <div key={idx} className="bg-brand-surface p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-brand-border flex flex-col gap-4">
                                 <h4 className="font-bold text-base sm:text-lg text-brand-text flex gap-3 items-start break-words"><span className="text-brand-primary shrink-0">Q{idx+1}.</span> <span className="break-words">{evalItem.question}</span></h4>
                                 
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-4 bg-brand-bg rounded-xl border border-brand-border break-words">
                                       <span className="text-xs uppercase font-bold text-brand-muted tracking-wider block mb-2">Your Answer</span>
                                       <p className="text-brand-text break-words">{evalItem.user_answer || "No answer provided."}</p>
                                    </div>
                                    <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/20 break-words">
                                       <span className="text-xs uppercase font-bold text-green-500 tracking-wider block mb-2">Ideal Answer</span>
                                       <p className="text-green-400 font-medium break-words">{evalItem.model_answer}</p>
                                    </div>
                                 </div>
                                 
                                 <div className="mt-2 p-4 bg-blue-500/10 rounded-xl border border-blue-500/20 flex gap-3 items-start break-words">
                                    <BrainCircuit className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                                    <div className="break-words">
                                       <span className="text-xs uppercase font-bold text-blue-400 tracking-wider block mb-1">Feedback</span>
                                       <p className="text-blue-300 leading-relaxed break-words">{evalItem.feedback}</p>
                                    </div>
                                 </div>
                              </div>
                           ))}
                           
                           <button 
                             onClick={() => { setWrittenAnswers({}); setWrittenGrading(null); }}
                             className="w-full py-4 mt-4 bg-brand-surface border border-brand-border hover:bg-brand-primary/10 text-brand-text rounded-2xl font-bold transition-all text-lg flex items-center justify-center gap-2"
                           >
                              <RotateCcw className="w-5 h-5"/> Retake Written Test
                           </button>
                        </div>
                     ) : (
                        <>
                           <ul className="space-y-6">
                             {shortList.map((q, i) => (
                                <li key={i} className="flex flex-col gap-3">
                                  <span className="text-brand-text text-xl font-medium flex items-start gap-3">
                                     <span className="w-10 h-10 rounded-xl bg-brand-primary/20 text-brand-primary flex items-center justify-center font-bold text-sm shrink-0 shadow-inner mt-0.5">Q{i+1}</span> 
                                     <span className="mt-1">{q}</span>
                                  </span>
                                  <textarea 
                                    disabled={isGrading}
                                    value={writtenAnswers[i] || ''}
                                    onChange={(e) => setWrittenAnswers({...writtenAnswers, [i]: e.target.value})}
                                    className="w-full bg-brand-bg border border-brand-border rounded-xl p-4 min-h-[120px] outline-none focus:border-brand-primary text-brand-text resize-y text-lg transition-colors focus:shadow-[0_0_15px_rgba(139,92,246,0.1)] disabled:opacity-50" 
                                    placeholder="Draft your long-form response here..."
                                  />
                                </li>
                             ))}
                           </ul>
                           
                           <button 
                             disabled={isGrading}
                             onClick={async () => {
                                setIsGrading(true);
                                try {
                                   const user_answers_arr = shortList.map((_, i) => writtenAnswers[i] || "I don't know");
                                   const res = await api.post("/api/grade-test", {
                                      questions: shortList,
                                      user_answers: user_answers_arr,
                                      context_text: flashcardSet.raw_content || ""
                                   }, { longRunning: true });
                                   setWrittenGrading(res.data);
                                } catch(e) {
                                   console.error(e);
                                   alert(getErrorMessage(e, "Failed to evaluate test."));
                                } finally {
                                   setIsGrading(false);
                                }
                             }}
                             className="w-full mt-8 py-4 bg-brand-primary text-white rounded-2xl font-bold shadow-lg hover:scale-[1.02] transition-all text-lg flex items-center justify-center gap-3 disabled:opacity-70 disabled:hover:scale-100"
                           >
                              {isGrading ? <span className="animate-pulse">Evaluating answers via AI...</span> : "Submit Answers for Evaluation"}
                           </button>
                        </>
                     )}
                   </div>
                </div>
              )}

              {/* TUTOR LESSON MODE */}
              {activeMode === 'tutor_lesson' && flashcardSet?.tutor_lesson && (
                <div className="w-full text-left space-y-6">
                   <div className="glass-panel p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-brand-primary/30 shadow-[0_0_30px_rgba(139,92,246,0.1)] bg-brand-primary/5">
                     <div className="flex items-center gap-4 mb-6 pt-2">
                        <div className="p-3 bg-brand-primary text-white rounded-2xl shadow-lg border border-brand-primary-hover"><BrainCircuit className="w-8 h-8" /></div>
                        <div>
                           <h2 className="text-2xl font-bold text-brand-text mb-1">Your AI Tutor Lesson</h2>
                           <p className="text-brand-muted text-sm uppercase tracking-widest font-bold">Generated Learning Guide</p>
                        </div>
                     </div>
                     <div className="text-left">
                        <Suspense fallback={<div className="h-40 w-full bg-brand-surface animate-pulse border border-brand-border rounded-3xl" />}>
                          <MarkdownRenderer content={flashcardSet.tutor_lesson} mode="tutor" />
                        </Suspense>
                     </div>
                   </div>
                </div>
              )}

              {/* DEFINITIONS MODE */}
              {activeMode === 'definitions' && definitionsList.length > 0 && (
                <div className="w-full text-left space-y-6">
                   <div className="glass-panel p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-brand-border shadow-lg">
                     <h2 className="text-xl sm:text-2xl font-bold text-brand-text mb-6">Definition Library</h2>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {definitionsList.map((def, idx) => (
                           <div key={idx} className="p-5 bg-brand-surface rounded-2xl border border-brand-border hover:border-brand-primary/30 transition-all hover:scale-[1.01] shadow-sm">
                              <strong className="text-brand-text text-base block mb-2">{def.term}</strong>
                              <p className="text-brand-muted text-sm leading-relaxed">{def.definition}</p>
                           </div>
                        ))}
                     </div>
                   </div>
                </div>
              )}

              {/* CONTENT MODE */}
              {activeMode === 'content' && flashcardSet?.raw_content && (
                <div className="w-full text-left space-y-6">
                   <div className="glass-panel p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-brand-border shadow-lg">
                     <h2 className="text-xl sm:text-2xl font-bold text-brand-text mb-4 flex items-center gap-3">
                        <FileText className="w-6 h-6 text-brand-muted" /> Source Content
                     </h2>
                     <div className="p-6 bg-brand-bg border border-brand-border rounded-2xl max-h-[70vh] overflow-y-auto custom-scrollbar">
                       <p className="text-brand-muted leading-relaxed font-mono text-sm whitespace-pre-wrap">
                          {flashcardSet.raw_content}
                       </p>
                     </div>
                   </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <aside className="w-96 fixed right-0 top-0 h-screen hidden lg:flex items-center p-6 bg-brand-bg/50 backdrop-blur-md border-l border-brand-border z-10">
         <StudyChat rawContent={flashcardSet?.raw_content || ""} initialQuery={chatQuery} onClearQuery={handleClearChatQuery} />
      </aside>

      {/* Mobile Chat Slide-over Drawer */}
      <AnimatePresence>
        {mobileChatOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileChatOpen(false)}
              className="fixed inset-0 bg-black z-30 lg:hidden"
            />
            {/* Drawer */}
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-brand-bg shadow-2xl border-l border-brand-border z-40 p-4 flex flex-col lg:hidden"
            >
              <div className="flex items-center justify-between mb-4 border-b border-brand-border pb-3">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="w-6 h-6 text-brand-primary" />
                  <span className="font-bold text-brand-text">AI Study Buddy</span>
                </div>
                <button 
                  onClick={() => setMobileChatOpen(false)}
                  className="p-2 text-brand-muted hover:text-brand-text bg-brand-surface border border-brand-border rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden flex flex-col h-full">
                <StudyChat rawContent={flashcardSet?.raw_content || ""} initialQuery={chatQuery} onClearQuery={handleClearChatQuery} className="w-full h-full border-0 bg-transparent shadow-none" />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Sticky Bottom Navigation Bar (rearranging modes for easy reach) */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-brand-surface/95 backdrop-blur-md border-t border-brand-border md:hidden flex justify-around items-center h-16 pb-safe px-2 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <button
          onClick={() => setActiveMode('notes')}
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-bold transition-all active:scale-90 ${
            activeMode === 'notes' ? 'text-brand-primary' : 'text-brand-muted'
          }`}
        >
          <AlignLeft className="w-5 h-5 mb-0.5" />
          <span>Notes</span>
        </button>

        <button
          onClick={() => setActiveMode('flashcards')}
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-bold transition-all active:scale-90 ${
            activeMode === 'flashcards' ? 'text-brand-primary' : 'text-brand-muted'
          }`}
        >
          <Layers className="w-5 h-5 mb-0.5" />
          <span>Cards</span>
        </button>

        {quizList.length > 0 && (
          <button
            onClick={() => setActiveMode('multiple_choice')}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-bold transition-all active:scale-90 ${
              activeMode === 'multiple_choice' ? 'text-brand-primary' : 'text-brand-muted'
            }`}
          >
            <Target className="w-5 h-5 mb-0.5" />
            <span>Quiz</span>
          </button>
        )}

        {flashcardSet?.tutor_lesson && (
          <button
            onClick={() => setActiveMode('tutor_lesson')}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-bold transition-all active:scale-90 ${
              activeMode === 'tutor_lesson' ? 'text-brand-primary' : 'text-brand-muted'
            }`}
          >
            <BrainCircuit className="w-5 h-5 mb-0.5" />
            <span>Tutor</span>
          </button>
        )}

        <button
          onClick={() => setMobileMoreOpen(true)}
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-bold transition-all active:scale-90 ${
            ['podcast', 'fill_blanks', 'written_test', 'true_false', 'definitions', 'content'].includes(activeMode)
              ? 'text-brand-primary'
              : 'text-brand-muted'
          }`}
        >
          <Hash className="w-5 h-5 mb-0.5" />
          <span>More</span>
        </button>
      </div>

      {/* Mobile "More Modes" Bottom Drawer Overlay */}
      <AnimatePresence>
        {mobileMoreOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMoreOpen(false)}
              className="fixed inset-0 bg-black z-30 md:hidden"
            />
            {/* Bottom Drawer */}
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="fixed bottom-0 left-0 right-0 max-h-[70vh] bg-brand-surface rounded-t-[2rem] border-t border-brand-border z-40 p-6 flex flex-col md:hidden pb-10 shadow-2xl"
            >
              {/* Drag Handle indicator */}
              <div className="w-12 h-1 bg-brand-border/80 rounded-full mx-auto mb-4 shrink-0" />
              
              <div className="flex items-center justify-between mb-6 pb-2 border-b border-brand-border/40">
                <span className="font-extrabold text-brand-text text-base">Select Study Mode</span>
                <button 
                  onClick={() => setMobileMoreOpen(false)}
                  className="p-2 text-brand-muted hover:text-brand-text bg-brand-bg border border-brand-border rounded-xl active:scale-95 transition-transform min-w-[36px] min-h-[36px] flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 overflow-y-auto max-h-[45vh] pr-1">
                {/* AI Mock Exam */}
                <button
                  onClick={() => { setActiveMode('mock_exam'); setMobileMoreOpen(false); }}
                  className={`p-4 rounded-2xl border flex flex-col items-center justify-center text-center gap-2 transition-all active:scale-95 min-h-[80px] ${
                    activeMode === 'mock_exam' ? 'border-brand-primary bg-brand-primary/10 text-brand-primary' : 'border-brand-border bg-brand-bg text-brand-muted'
                  }`}
                >
                  <Award className="w-6 h-6" />
                  <span className="text-xs font-bold">AI Mock Exam</span>
                </button>

                {/* Podcast */}
                <button
                  onClick={() => { setActiveMode('podcast'); setMobileMoreOpen(false); }}
                  className={`p-4 rounded-2xl border flex flex-col items-center justify-center text-center gap-2 transition-all active:scale-95 min-h-[80px] ${
                    activeMode === 'podcast' ? 'border-brand-primary bg-brand-primary/10 text-brand-primary' : 'border-brand-border bg-brand-bg text-brand-muted'
                  }`}
                >
                  <Headphones className="w-6 h-6" />
                  <span className="text-xs font-bold">Podcast</span>
                </button>

                {/* Fill-in-the-Blank */}
                {blanksList.length > 0 && (
                  <button
                    onClick={() => { setActiveMode('fill_blanks'); setMobileMoreOpen(false); }}
                    className={`p-4 rounded-2xl border flex flex-col items-center justify-center text-center gap-2 transition-all active:scale-95 min-h-[80px] ${
                      activeMode === 'fill_blanks' ? 'border-brand-primary bg-brand-primary/10 text-brand-primary' : 'border-brand-border bg-brand-bg text-brand-muted'
                    }`}
                  >
                    <Type className="w-6 h-6" />
                    <span className="text-xs font-bold">Fill-in-the-Blank</span>
                  </button>
                )}

                {/* Written Test */}
                {shortList.length > 0 && (
                  <button
                    onClick={() => { setActiveMode('written_test'); setMobileMoreOpen(false); }}
                    className={`p-4 rounded-2xl border flex flex-col items-center justify-center text-center gap-2 transition-all active:scale-95 min-h-[80px] ${
                      activeMode === 'written_test' ? 'border-brand-primary bg-brand-primary/10 text-brand-primary' : 'border-brand-border bg-brand-bg text-brand-muted'
                    }`}
                  >
                    <BookOpen className="w-6 h-6" />
                    <span className="text-xs font-bold">Written Test</span>
                  </button>
                )}

                {/* True/False */}
                {trueFalseList.length > 0 && (
                  <button
                    onClick={() => { setActiveMode('true_false'); setMobileMoreOpen(false); }}
                    className={`p-4 rounded-2xl border flex flex-col items-center justify-center text-center gap-2 transition-all active:scale-95 min-h-[80px] ${
                      activeMode === 'true_false' ? 'border-brand-primary bg-brand-primary/10 text-brand-primary' : 'border-brand-border bg-brand-bg text-brand-muted'
                    }`}
                  >
                    <CheckCircle2 className="w-6 h-6" />
                    <span className="text-xs font-bold">True / False</span>
                  </button>
                )}

                {/* Definitions */}
                {definitionsList.length > 0 && (
                  <button
                    onClick={() => { setActiveMode('definitions'); setMobileMoreOpen(false); }}
                    className={`p-4 rounded-2xl border flex flex-col items-center justify-center text-center gap-2 transition-all active:scale-95 min-h-[80px] ${
                      activeMode === 'definitions' ? 'border-brand-primary bg-brand-primary/10 text-brand-primary' : 'border-brand-border bg-brand-bg text-brand-muted'
                    }`}
                  >
                    <BookOpen className="w-6 h-6" />
                    <span className="text-xs font-bold">Definitions</span>
                  </button>
                )}

                {/* Source Content */}
                {flashcardSet?.raw_content && (
                  <button
                    onClick={() => { setActiveMode('content'); setMobileMoreOpen(false); }}
                    className={`p-4 rounded-2xl border flex flex-col items-center justify-center text-center gap-2 transition-all active:scale-95 min-h-[80px] ${
                      activeMode === 'content' ? 'border-brand-primary bg-brand-primary/10 text-brand-primary' : 'border-brand-border bg-brand-bg text-brand-muted'
                    }`}
                  >
                    <AlignLeft className="w-6 h-6" />
                    <span className="text-xs font-bold">Source Content</span>
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating Action Button (FAB) for AI Assistant (visible on < 1024px where right sidebar is hidden, and offset upwards to clear bottom tab bar on mobile) */}
      <div className="fixed bottom-20 md:bottom-6 right-6 z-30 lg:hidden">
        <button
          onClick={() => setMobileChatOpen(true)}
          className="w-14 h-14 bg-brand-primary text-white rounded-full shadow-[0_4px_25px_rgba(139,92,246,0.5)] flex items-center justify-center md:hover:scale-110 active:scale-95 transition-all relative border border-brand-primary-hover group min-w-[56px] min-h-[56px]"
          title="Ask AI Study Buddy"
        >
          {/* Pulsing glow ring */}
          <span className="absolute -inset-1.5 rounded-full bg-brand-primary/25 animate-ping opacity-75 pointer-events-none" />
          <BrainCircuit className="w-6 h-6 animate-pulse" />
          
          {/* Desktop/Tablet Hover Tooltip */}
          <span className="absolute right-16 bg-brand-surface border border-brand-border text-brand-text text-xs font-bold px-3 py-1.5 rounded-xl shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden md:block">
            Ask AI Assistant
          </span>
        </button>
      </div>

      <SocraticTutorModal 
        isOpen={isTutorOpen} 
        onClose={() => setIsTutorOpen(false)} 
        question={tutorQuestion} 
        correctAnswer={tutorAnswer} 
        contextText={flashcardSet?.raw_content} 
      />
    </div>
  );
}
