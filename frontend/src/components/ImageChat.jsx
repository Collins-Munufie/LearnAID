import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, Image as ImageIcon, Send, Trash2, Plus, 
  Brain, FileText, Sparkles, X, Loader2, Maximize2, 
  ChevronRight, ArrowRight, MessageSquare, Compass, Play,
  ChevronLeft, Download, BookOpen
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Logo from './Logo';
import api, { getErrorMessage } from '../lib/api';
import MarkdownRenderer from './MarkdownRenderer';

const ReportSkeleton = () => (
  <div className="flex flex-col gap-6 animate-pulse py-4">
    <div className="h-7 w-2/5 bg-brand-border rounded-lg"></div>
    <div className="h-4 w-full bg-brand-border/60 rounded-md"></div>
    <div className="h-4 w-11/12 bg-brand-border/60 rounded-md"></div>
    <div className="h-4 w-5/6 bg-brand-border/40 rounded-md"></div>
    
    <div className="h-6 w-1/4 bg-brand-border rounded-lg mt-6"></div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="h-20 bg-brand-border/30 rounded-xl border border-brand-border/40 p-4 flex flex-col gap-2">
        <div className="h-4 w-1/3 bg-brand-border/60 rounded"></div>
        <div className="h-3.5 w-5/6 bg-brand-border/40 rounded"></div>
      </div>
      <div className="h-20 bg-brand-border/30 rounded-xl border border-brand-border/40 p-4 flex flex-col gap-2">
        <div className="h-4 w-1/4 bg-brand-border/60 rounded"></div>
        <div className="h-3.5 w-4/5 bg-brand-border/40 rounded"></div>
      </div>
    </div>

    <div className="h-6 w-1/3 bg-brand-border rounded-lg mt-6"></div>
    <div className="border border-brand-border/60 rounded-2xl p-4 flex flex-col gap-3">
      <div className="h-4 w-full bg-brand-border/60 rounded"></div>
      <div className="h-4 w-11/12 bg-brand-border/40 rounded"></div>
      <div className="h-4 w-4/5 bg-brand-border/40 rounded"></div>
    </div>
  </div>
);

export default function ImageChat() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [activeImage, setActiveImage] = useState(null); // Currently highlighted image on the canvas
  
  // Setup / Upload states
  const [images, setImages] = useState([]); // List of base64 data URLs
  const [question, setQuestion] = useState('');
  
  // UI / Status states
  const [loading, setLoading] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [followupText, setFollowupText] = useState('');
  const [zoomedImage, setZoomedImage] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('report'); // 'report' or 'chat'
  
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const getLatestAIMessage = () => {
    if (!activeSession?.messages) return null;
    const aiMessages = activeSession.messages.filter(m => m.sender === 'ai');
    if (aiMessages.length === 0) return null;
    return aiMessages[aiMessages.length - 1];
  };

  const exportReport = () => {
    const latestAI = getLatestAIMessage();
    if (!latestAI) return;
    
    const title = activeSession.title || "Visual Study Guide";
    const dateStr = new Date(activeSession.created_at || Date.now()).toLocaleDateString();
    
    const content = `# Study Report: ${title}\nGenerated on ${dateStr} by Cognify AI\n\n${latestAI.text}`;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_report.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Quick Chips
  const promptChips = [
    { label: "Explain this diagram", text: "Explain this diagram and its core components in detail." },
    { label: "Summarize this flowchart", text: "Walk me through this flowchart step-by-step, detailing the decisions and processes." },
    { label: "Solve/Explain equation", text: "Explain the formulas or mathematical equations shown here, and show how to solve them step-by-step." },
    { label: "Create flashcards", text: "Based on this image, extract the key terms and generate 5 flashcards (Question & Answer format)." },
    { label: "Generate quiz", text: "Create 3 multiple choice questions (MCQs) with correct answers based on this visual material." },
    { label: "Simplify for a beginner", text: "Explain the concepts in this image in very simple terms, as if you were explaining to a beginner." }
  ];

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeSession?.messages, loading]);

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const response = await api.get('/api/image-chats/sessions');
      setSessions(response.data);
    } catch (err) {
      console.error("Failed to load image sessions:", err);
    } finally {
      setLoadingSessions(false);
    }
  };

  const loadSession = async (sessionId) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/api/image-chats/session/${sessionId}`);
      const data = response.data;
      setActiveSession(data);
      if (data.images && data.images.length > 0) {
        setActiveImage(data.images[0]);
      } else {
        setActiveImage(null);
      }
      // Reset setup states
      setImages([]);
      setQuestion('');
      setActiveTab('report'); // Default to Study Report first
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load session."));
    } finally {
      setLoading(false);
    }
  };

  const deleteSession = async (e, sessionId) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this chat session?")) return;
    
    try {
      await api.delete(`/api/image-chats/session/${sessionId}`);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSession?.id === sessionId) {
        setActiveSession(null);
        setActiveImage(null);
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  };

  const startNewChat = () => {
    setActiveSession(null);
    setActiveImage(null);
    setImages([]);
    setQuestion('');
    setError('');
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setError('');
    const validImages = files.filter(f => f.type.startsWith('image/'));
    if (validImages.length !== files.length) {
      setError("Please upload images only.");
    }

    const base64Promises = validImages.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
    });

    const base64Images = await Promise.all(base64Promises);
    setImages(prev => [...prev, ...base64Images]);
    
    // Clear input value so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (idxToRemove) => {
    setImages(prev => prev.filter((_, idx) => idx !== idxToRemove));
  };

  const submitInitialChat = async () => {
    if (!images.length) {
      setError("Please upload at least one image.");
      return;
    }
    if (!question.trim()) {
      setError("Please enter a question or choose a prompt chip.");
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.post('/api/image-chats/session', {
        images,
        initial_question: question
      }, { longRunning: true });

      const data = response.data;
      setActiveSession(data);
      if (data.images && data.images.length > 0) {
        setActiveImage(data.images[0]);
      } else {
        setActiveImage(null);
      }
      setActiveTab('report'); // Show the fresh report right away
      fetchSessions(); // Refresh list
    } catch (err) {
      setError(getErrorMessage(err, "Failed to analyze image. Ensure your AI keys are active."));
    } finally {
      setLoading(false);
    }
  };

  const submitFollowupMessage = async (e) => {
    e.preventDefault();
    if (!followupText.trim() || loading || !activeSession) return;

    const query = followupText.trim();
    setFollowupText('');
    setLoading(true);
    setError('');

    // Append user message locally for immediate UI update
    const tempUserMsg = {
      id: Date.now(),
      text: query,
      sender: "user",
      timestamp: new Date().toISOString()
    };
    
    setActiveSession(prev => ({
      ...prev,
      messages: [...prev.messages, tempUserMsg]
    }));

    try {
      const response = await api.post(`/api/image-chats/session/${activeSession.id}/message`, {
        text: query
      }, { longRunning: true });

      // Append AI response
      setActiveSession(prev => ({
        ...prev,
        messages: [...prev.messages, response.data]
      }));
    } catch (err) {
      setError(getErrorMessage(err, "Failed to send message."));
    } finally {
      setLoading(false);
    }
  };

  const handleQuickToolClick = async (toolQuery) => {
    if (loading || !activeSession) return;
    setLoading(true);
    setError('');
    setActiveTab('report'); 

    // Append user message locally
    const tempUserMsg = {
      id: Date.now(),
      text: toolQuery,
      sender: "user",
      timestamp: new Date().toISOString()
    };
    
    setActiveSession(prev => ({
      ...prev,
      messages: [...prev.messages, tempUserMsg]
    }));

    try {
      const response = await api.post(`/api/image-chats/session/${activeSession.id}/message`, {
        text: toolQuery
      }, { longRunning: true });

      // Append AI response
      setActiveSession(prev => ({
        ...prev,
        messages: [...prev.messages, response.data]
      }));
    } catch (err) {
      setError(getErrorMessage(err, "Failed to analyze request."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text relative pb-32 overflow-hidden flex flex-col">
      {/* Ambient background glows */}
      <div className="absolute top-[10%] left-[-15%] w-[600px] h-[600px] bg-brand-primary/5 rounded-full blur-[130px] pointer-events-none"></div>
      <div className="absolute top-[40%] right-[-10%] w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none"></div>

      {/* HEADER / NAVBAR */}
      <header className="sticky top-0 z-50 bg-brand-surface/80 backdrop-blur-md border-b border-brand-border">
         <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate('/dashboard')}
                className="p-2 hover:bg-brand-surface border border-brand-border rounded-xl transition-all active:scale-95 cursor-pointer flex items-center justify-center"
                title="Back to Dashboard"
              >
                <ChevronLeft className="w-5 h-5 text-brand-muted" />
              </button>
              <Logo size="small" />
            </div>
            <span className="hidden sm:inline font-extrabold text-sm text-brand-muted uppercase tracking-wider">Visual AI Companion</span>
         </div>
      </header>

      {/* MAIN COMPONENT LAYOUT */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-8 w-full relative z-10 flex flex-col lg:flex-row gap-6 items-stretch h-[calc(100vh-8rem)]">
      
      {/* LEFT COLUMN: History Sidebar */}
      <div className="w-full lg:w-72 shrink-0 flex flex-col gap-4 bg-brand-surface/40 backdrop-blur-md border border-brand-border/60 rounded-3xl p-4 max-h-[25vh] lg:max-h-full overflow-y-auto shadow-sm">
        <div className="flex items-center justify-between pb-2 border-b border-brand-border/60">
          <span className="font-extrabold text-brand-text text-xs uppercase tracking-wider flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-brand-primary" /> Chat History
          </span>
          <button
            onClick={startNewChat}
            className="px-2 py-1 rounded-lg border border-brand-border bg-brand-bg hover:bg-brand-surface text-brand-primary font-bold text-xs transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
            title="Start New Chat"
          >
            <Plus className="w-3.5 h-3.5" /> New
          </button>
        </div>

        {loadingSessions ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 text-brand-muted animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center text-xs text-brand-muted py-8 italic">
            No past sessions.
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 overflow-y-auto max-h-full custom-scrollbar pr-1">
            {sessions.map((s) => {
              const isActive = activeSession?.id === s.id;
              return (
                <div
                  key={s.id}
                  onClick={() => loadSession(s.id)}
                  className={`w-full p-3 rounded-xl border text-left flex items-start justify-between gap-2 group transition-all relative cursor-pointer ${
                    isActive 
                      ? 'border-brand-primary/30 bg-brand-primary/5 text-brand-primary font-bold' 
                      : 'border-brand-border/40 bg-brand-surface hover:bg-brand-bg/50 text-brand-text'
                  }`}
                >
                  <div className="flex flex-col gap-0.5 truncate flex-1 pr-4">
                    <span className="text-xs font-semibold truncate leading-snug">{s.title}</span>
                    <span className="text-[10px] text-brand-muted">
                      {new Date(s.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    onClick={(e) => deleteSession(e, s.id)}
                    className="p-1 rounded-lg hover:bg-red-500/10 text-brand-muted hover:text-red-500 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all active:scale-95 shrink-0 cursor-pointer"
                    title="Delete Chat"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Chat / Setup Area */}
      <div className="flex-1 flex flex-col bg-brand-surface border border-brand-border rounded-3xl overflow-hidden relative min-h-[50vh] lg:min-h-0 shadow-sm">
        
        {error && (
          <div className="p-3 bg-red-500/10 border-b border-red-500/20 text-xs font-semibold text-red-600 flex items-center justify-between gap-4 z-10">
            <span>{error}</span>
            <button onClick={() => setError('')} className="p-1 hover:bg-red-500/10 rounded-lg">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* SETUP PHASE (Sleek Two-Column Workspace) */}
        {!activeSession ? (
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 flex flex-col gap-8 custom-scrollbar">
            
            {/* Landing Title */}
            <div className="flex flex-col gap-2 text-center max-w-xl mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 text-brand-primary flex items-center justify-center mx-auto mb-2 border border-brand-primary/20 shadow-inner">
                <Brain className="w-6 h-6 text-brand-primary animate-pulse" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-brand-text">Ask Cognify Visuals</h2>
              <p className="text-xs sm:text-sm text-brand-muted leading-relaxed">
                Analyze and interact with diagrams, whiteboard photos, scientific drawings, or mathematical equations using space-age AI diagnostics.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch w-full flex-1">
              
              {/* Setup Left: Upload Box (5 cols) */}
              <div className="lg:col-span-5 flex flex-col gap-5 bg-brand-bg/30 border border-brand-border rounded-2xl p-5 justify-between">
                <div className="flex-1 flex flex-col gap-4">
                  <span className="text-xs font-bold text-brand-muted uppercase tracking-wider block">Visual Assets</span>
                  
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-brand-border hover:border-brand-primary/30 bg-brand-surface/40 hover:bg-brand-surface rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-300 group shadow-sm flex-1 min-h-[150px]"
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      multiple 
                      accept="image/*" 
                      onChange={handleFileChange} 
                      className="hidden" 
                    />
                    <div className="p-3 bg-brand-bg border border-brand-border rounded-xl text-brand-muted group-hover:text-brand-primary group-hover:border-brand-primary/20 transition-all flex items-center justify-center shadow-inner">
                      <Upload className="w-5 h-5 group-hover:scale-115 transition-all duration-300" />
                    </div>
                    <div className="text-center">
                      <span className="font-extrabold text-brand-text text-xs block">Choose or drop files</span>
                      <span className="text-[9px] text-brand-muted block mt-0.5">PNG, JPG, WEBP (Multiple allowed)</span>
                    </div>
                  </div>
                </div>

                {/* Thumbnail Previews */}
                {images.length > 0 && (
                  <div className="flex flex-wrap gap-2.5 items-center border-t border-brand-border pt-4 mt-2">
                    {images.map((img, idx) => (
                      <div key={idx} className="relative w-14 h-14 rounded-xl border border-brand-border/60 overflow-hidden bg-brand-surface group shadow-sm">
                        <img src={img} alt="Upload preview" className="w-full h-full object-cover" />
                        <button 
                          onClick={() => removeImage(idx)}
                          className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 hover:bg-red-500 rounded text-white opacity-0 group-hover:opacity-100 transition-all shadow-sm cursor-pointer"
                          title="Remove Image"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Setup Right: Prompt Inputs (7 cols) */}
              <div className="lg:col-span-7 flex flex-col gap-5 bg-brand-bg/30 border border-brand-border rounded-2xl p-5 justify-between">
                <div className="flex flex-col gap-4">
                  <span className="text-xs font-bold text-brand-muted uppercase tracking-wider block">Target Question</span>
                  
                  {/* Textarea */}
                  <textarea
                    rows={4}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Type what you'd like to understand about the uploaded visual material..."
                    className="w-full p-4 rounded-xl border border-brand-border bg-brand-surface text-brand-text text-sm focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10 transition-all resize-none custom-scrollbar shadow-inner"
                  ></textarea>

                  {/* Quick prompts */}
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider flex items-center gap-1.5"><Compass className="w-3.5 h-3.5 text-brand-primary" /> Suggested Prompts</span>
                    <div className="flex flex-wrap gap-1.5">
                      {promptChips.slice(0, 4).map((chip, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setQuestion(chip.text);
                            setError('');
                          }}
                          className="px-3 py-1.5 rounded-full border border-brand-border/60 hover:border-brand-primary/30 bg-brand-surface hover:bg-brand-bg text-[10px] sm:text-xs font-bold text-brand-text cursor-pointer transition-all active:scale-95"
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={submitInitialChat}
                  disabled={loading || !images.length || !question.trim()}
                  className="w-full py-4 px-6 rounded-xl bg-brand-primary hover:bg-brand-primary-hover disabled:opacity-30 disabled:cursor-not-allowed text-white font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md active:scale-97 cursor-pointer hover:shadow-lg hover:shadow-brand-primary/10"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Analyze & Chat
                    </>
                  )}
                </button>
              </div>

            </div>

          </div>
        ) : (
          
          /* CHAT ACTIVE PHASE (Stunning Split Study Dashboard Layout) */
          <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden">
            
            {/* Left Pane: Image Canvas (42%) */}
            <div className="w-full lg:w-[42%] shrink-0 flex flex-col border-b lg:border-b-0 lg:border-r border-brand-border bg-brand-bg/40 p-5 overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-brand-border/60">
                <span className="font-extrabold text-brand-text text-xs uppercase tracking-wider flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-brand-primary" /> Visual Canvas
                </span>
                <span className="text-[10px] bg-brand-primary/10 border border-brand-primary/20 text-brand-primary font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                  {activeSession.images?.length} Image{activeSession.images?.length > 1 ? 's' : ''} Loaded
                </span>
              </div>
              
              {/* Highlighted image view */}
              <div className="h-[250px] sm:h-[300px] lg:h-[38vh] bg-brand-surface/30 border border-brand-border/50 rounded-2xl overflow-hidden relative group flex items-center justify-center p-2 mb-4 shrink-0 shadow-xs">
                {activeImage ? (
                  <>
                    <img 
                      src={activeImage} 
                      alt="Active visual canvas" 
                      className="max-w-full max-h-full object-contain rounded-xl shadow-xs transition-transform duration-300" 
                    />
                    <button 
                      onClick={() => setZoomedImage(activeImage)}
                      className="absolute bottom-3 right-3 p-2.5 bg-brand-surface/70 hover:bg-brand-primary hover:text-white backdrop-blur-md border border-brand-border rounded-xl text-brand-text opacity-0 group-hover:opacity-100 transition-all shadow-md scale-95 hover:scale-100 cursor-pointer flex items-center justify-center"
                      title="Open Zoom Viewer"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <div className="text-brand-muted text-xs italic">No image selected.</div>
                )}
              </div>

              {/* Horizontal Thumbnail Strip for switching */}
              {activeSession.images?.length > 1 && (
                <div className="flex gap-2.5 overflow-x-auto pb-2 custom-scrollbar shrink-0 mb-4">
                  {activeSession.images.map((img, idx) => {
                    const isSelected = activeImage === img;
                    return (
                      <button
                        key={idx}
                        onClick={() => setActiveImage(img)}
                        className={`relative w-14 h-14 rounded-xl border overflow-hidden bg-brand-surface transition-all shrink-0 cursor-pointer ${
                          isSelected 
                            ? 'border-brand-primary ring-2 ring-brand-primary/25 scale-[1.03] shadow-md' 
                            : 'border-brand-border/80 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={img} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Visual Study Tools (Occupies vertical empty space and adds value) */}
              <div className="bg-brand-surface border border-brand-border/60 rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
                <span className="font-extrabold text-[10px] text-brand-text uppercase tracking-wider flex items-center gap-1.5 border-b border-brand-border/40 pb-2">
                  <Brain className="w-3.5 h-3.5 text-brand-primary animate-pulse" /> Visual Study Tools
                </span>
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleQuickToolClick("Explain the core components and flow of this visual diagram in detail.")}
                    disabled={loading}
                    className="p-2.5 rounded-xl border border-brand-border bg-brand-bg/30 hover:bg-brand-bg text-left cursor-pointer transition-all active:scale-95 flex flex-col gap-1 disabled:opacity-50 disabled:cursor-not-allowed group border-l-2 border-l-brand-primary"
                  >
                    <span className="text-[10px] font-black text-brand-primary uppercase tracking-wider">Explain Flow</span>
                    <span className="text-[9px] text-brand-muted line-clamp-2">Detail components & processes step-by-step.</span>
                  </button>

                  <button
                    onClick={() => handleQuickToolClick("Based on this image, extract the key terms and generate 5 flashcards (Question & Answer format).")}
                    disabled={loading}
                    className="p-2.5 rounded-xl border border-brand-border bg-brand-bg/30 hover:bg-brand-bg text-left cursor-pointer transition-all active:scale-95 flex flex-col gap-1 disabled:opacity-50 disabled:cursor-not-allowed group border-l-2 border-l-brand-secondary"
                  >
                    <span className="text-[10px] font-black text-brand-secondary uppercase tracking-wider">Generate Cards</span>
                    <span className="text-[9px] text-brand-muted line-clamp-2">Extract key terms into Q&A flashcards.</span>
                  </button>

                  <button
                    onClick={() => handleQuickToolClick("Create 3 multiple choice questions (MCQs) with correct answers based on this visual material.")}
                    disabled={loading}
                    className="p-2.5 rounded-xl border border-brand-border bg-brand-bg/30 hover:bg-brand-bg text-left cursor-pointer transition-all active:scale-95 flex flex-col gap-1 disabled:opacity-50 disabled:cursor-not-allowed group border-l-2 border-l-purple-500"
                  >
                    <span className="text-[10px] font-black text-purple-600 uppercase tracking-wider">Create Quiz</span>
                    <span className="text-[9px] text-brand-muted line-clamp-2">Generate a 3-question MCQ mini quiz.</span>
                  </button>

                  <button
                    onClick={() => handleQuickToolClick("Explain the concepts in this image in very simple terms, as if you were explaining to a beginner.")}
                    disabled={loading}
                    className="p-2.5 rounded-xl border border-brand-border bg-brand-bg/30 hover:bg-brand-bg text-left cursor-pointer transition-all active:scale-95 flex flex-col gap-1 disabled:opacity-50 disabled:cursor-not-allowed group border-l-2 border-l-amber-500"
                  >
                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider">Simplify Visual</span>
                    <span className="text-[9px] text-brand-muted line-clamp-2">Break down the concept for beginners.</span>
                  </button>
                </div>

                <div className="bg-brand-bg/40 rounded-xl p-2.5 border border-brand-border/50 flex items-center justify-between text-[9px] text-brand-muted font-semibold mt-1">
                  <span>Status: Active</span>
                  <span>Messages: {activeSession.messages?.length}</span>
                  <span>Source: Visual Asset</span>
                </div>
              </div>

            </div>

            {/* Right Pane: Structured Study & Analysis Panel */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-brand-surface">
              
              {/* Header Panel with Tabs */}
              <div className="px-5 py-3.5 border-b border-brand-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-brand-surface/40 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-brand-primary/10 flex items-center justify-center border border-brand-primary/15">
                    <BookOpen className="w-4 h-4 text-brand-primary" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-extrabold text-xs text-brand-text uppercase tracking-wider">
                      Study Dashboard
                    </span>
                    <span className="text-[9px] text-brand-muted font-bold uppercase tracking-wider font-mono">
                      Structured Tutor Companion
                    </span>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 bg-brand-bg/85 p-1 border border-brand-border rounded-xl">
                  <button
                    onClick={() => setActiveTab('report')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'report'
                        ? 'bg-brand-surface text-brand-primary border border-brand-border shadow-xs'
                        : 'text-brand-muted hover:text-brand-text border border-transparent'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Study Report</span>
                  </button>
                  
                  <button
                    onClick={() => setActiveTab('chat')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeTab === 'chat'
                        ? 'bg-brand-surface text-brand-primary border border-brand-border shadow-xs'
                        : 'text-brand-muted hover:text-brand-text border border-transparent'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Chat History</span>
                  </button>
                </div>

                {/* Export Button */}
                {getLatestAIMessage() && (
                  <button
                    onClick={exportReport}
                    className="self-start sm:self-center px-3 py-1.5 rounded-xl border border-brand-border bg-brand-surface hover:bg-brand-bg text-brand-text font-bold text-xs transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-xs"
                    title="Download Markdown Report"
                  >
                    <Download className="w-3.5 h-3.5 text-brand-primary" />
                    <span>Export</span>
                  </button>
                )}
              </div>

              {/* Scrollable Workspace Content */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar bg-gradient-to-b from-brand-bg/10 to-brand-bg/30">
                {activeTab === 'report' ? (
                  <>
                    {/* Active Question Title Card */}
                    <div className="bg-brand-surface border border-brand-border/60 rounded-2xl p-4 mb-5 flex items-start gap-3 shadow-xs">
                      <div className="w-8 h-8 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0 border border-brand-primary/15">
                        <Brain className="w-4 h-4 text-brand-primary" />
                      </div>
                      <div className="flex-1 flex flex-col gap-0.5">
                        <span className="text-[9px] uppercase font-bold text-brand-muted tracking-wider">Analysis Target</span>
                        <span className="text-xs sm:text-sm font-bold text-brand-text leading-snug">{activeSession.title}</span>
                      </div>
                    </div>

                    {loading && activeSession.messages && activeSession.messages[activeSession.messages.length - 1]?.sender === 'user' ? (
                      <ReportSkeleton />
                    ) : getLatestAIMessage() ? (
                      <div className="animate-fade-in pb-10">
                        <MarkdownRenderer content={getLatestAIMessage().text} mode="study" />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20 text-brand-muted gap-2">
                        <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
                        <p className="text-xs font-semibold">Preparing study analysis...</p>
                      </div>
                    )}
                  </>
                ) : (
                  /* CHAT HISTORY THREAD */
                  <div className="flex flex-col gap-4 pb-10">
                    {activeSession.messages?.map((msg) => {
                      const isAI = msg.sender === 'ai';
                      return (
                        <div 
                          key={msg.id} 
                          className={`flex flex-col p-4 sm:p-5 rounded-2xl border transition-all shadow-xs ${
                            isAI 
                              ? 'bg-brand-surface border-brand-border text-brand-text' 
                              : 'bg-brand-primary/5 border-brand-primary/10 text-brand-text'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                isAI 
                                  ? 'bg-brand-bg text-brand-primary border-brand-border' 
                                  : 'bg-brand-primary text-white border-brand-primary'
                              }`}>
                                {isAI ? 'Tutor' : 'Student'}
                              </span>
                            </div>
                            <span className="text-[9px] text-brand-muted font-bold">
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          
                          <div className="text-xs sm:text-sm leading-relaxed text-brand-text break-words">
                            {isAI ? (
                              <MarkdownRenderer content={msg.text} mode="study" />
                            ) : (
                              <p className="font-semibold text-brand-text">{msg.text}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {loading && (
                      <div className="flex justify-start animate-pulse">
                        <div className="px-4.5 py-3 bg-brand-surface border border-brand-border rounded-2xl flex items-center gap-2 text-brand-primary shadow-xs">
                          <Loader2 className="w-4 h-4 animate-spin text-brand-primary" />
                          <span className="text-xs font-bold text-brand-muted">Tutor is analyzing...</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input Bar */}
              <form 
                onSubmit={submitFollowupMessage}
                className="p-4 border-t border-brand-border bg-brand-bg/85 backdrop-blur-md flex items-center gap-3 shrink-0"
              >
                <input 
                  type="text" 
                  value={followupText}
                  onChange={(e) => setFollowupText(e.target.value)}
                  disabled={loading}
                  placeholder="Ask a follow-up question about this study material..."
                  className="flex-1 py-3 px-4.5 rounded-2xl border border-brand-border bg-brand-surface text-brand-text text-sm focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10 transition-all shadow-inner"
                />
                <button
                  type="submit"
                  disabled={loading || !followupText.trim()}
                  className="p-3 rounded-2xl bg-brand-primary hover:bg-brand-primary-hover text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-md flex items-center justify-center shrink-0 active:scale-95 hover:shadow-brand-primary/10 hover:shadow-lg cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>

            </div>

          </div>
        )}

      </div>

      {/* FULL-SCREEN ZOOM OVERLAY MODAL */}
      <AnimatePresence>
        {zoomedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setZoomedImage(null)}
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 cursor-zoom-out"
          >
            <button 
              onClick={() => setZoomedImage(null)}
              className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white rounded-xl transition-all"
            >
              <X className="w-6 h-6" />
            </button>
            <motion.img 
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={zoomedImage} 
              alt="Zoomed visual content" 
              className="max-w-full max-h-full rounded-2xl object-contain shadow-2xl" 
            />
          </motion.div>
        )}
      </AnimatePresence>

      </main>
    </div>
  );
}
