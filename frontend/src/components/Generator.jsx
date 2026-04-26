import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import UploadSection from "./UploadSection";
import FlashcardList from "./FlashcardList";
import DocumentInfoPanel from "./DocumentInfoPanel";
import { BrainCircuit, Save, Loader2, Check, ArrowRight, BookOpen, Layers, Target, FileText, Headphones, Zap, ScrollText } from "lucide-react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Generator() {
  // Phase management: 1 (Upload) -> 2 (Select Modules) -> 3 (Results)
  const [phase, setPhase] = useState(1);
  const [extractedData, setExtractedData] = useState(null);
  
  // Selection State
  const allModules = [
    { id: "Notes", icon: <FileText />, label: "Notes" },
    { id: "Multiple Choice (Quiz)", icon: <Target />, label: "Multiple Choice (Quiz)" },
    { id: "Flashcards", icon: <Layers />, label: "Flashcards" },
    { id: "Podcast", icon: <Headphones />, label: "Podcast" },
    { id: "Fill-in-the-Blank", icon: <ScrollText />, label: "Fill-in-the-Blank" },
    { id: "Written Test", icon: <BookOpen />, label: "Written Test" },
    { id: "Tutor Lesson", icon: <BrainCircuit />, label: "Tutor Lesson" },
    { id: "Content", icon: <Zap />, label: "Content" }
  ];
  
  const [selectedModules, setSelectedModules] = useState(["Notes", "Multiple Choice (Quiz)", "Flashcards", "Content"]);

  const [flashcards, setFlashcards] = useState([]);
  const [completeStudySet, setCompleteStudySet] = useState(null);
  const [documentInfo, setDocumentInfo] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedSetId, setSavedSetId] = useState(null);
  const [setTitle, setSetTitle] = useState("");

  const { user } = useAuth();
  const navigate = useNavigate();

  const handleFileUpload = async (file) => {
    setIsGenerating(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post("http://127.0.0.1:8000/api/extract-document", formData);
      setExtractedData(response.data.extracted_text);
      setSetTitle(response.data.title);
      setPhase(2);
    } catch (err) {
      console.error("Extraction error:", err);
      setError(err.response?.data?.detail || "An error occurred while extracting the document.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUrlSubmit = async (url) => {
    setIsGenerating(true);
    setError("");

    try {
      const response = await axios.post("http://127.0.0.1:8000/api/extract-url", { url, card_type: "Standard Q&A" });
      setExtractedData(response.data.extracted_text);
      
      try {
        const domain = new URL(url).hostname.replace("www.", "");
        setSetTitle(`${domain} Study Material`);
      } catch (e) {
        setSetTitle("Web Link Set");
      }
      setPhase(2);
    } catch (err) {
      console.error("Extraction error:", err);
      setError(err.response?.data?.detail || "An error occurred while extracting from URL.");
    } finally {
      setIsGenerating(false);
    }
  };

  const executeGeneration = async () => {
    if (selectedModules.length === 0) {
      setError("Please select at least one module.");
      return;
    }
    
    setIsGenerating(true);
    setError("");
    
    try {
      const response = await axios.post("http://127.0.0.1:8000/api/generate-selected", {
        extracted_text: extractedData,
        modules: selectedModules,
        title: setTitle || "Untitled Set"
      });
      
      const payloadData = response.data;
      
      // Auto-save logic instantly bypasses phase 3 constraint
      const postPayload = {
        title: setTitle || "Untitled Set",
        flashcards: payloadData.flashcards || [],
        summary: payloadData.summary || "",
        key_points: payloadData.key_points || [],
        quiz: payloadData.quiz || [],
        fill_blanks: payloadData.fill_blanks || [],
        short_questions: payloadData.short_questions || [],
        true_false: payloadData.true_false || [],
        definitions: payloadData.definitions || [],
        tutor_lesson: payloadData.tutor_lesson || "",
        raw_content: payloadData.raw_content || "",
        selected_modules: selectedModules
      };
      
      // Check auth before auto-save
      if (!user) {
         setCompleteStudySet(payloadData);
         setFlashcards(payloadData.flashcards || []);
         setDocumentInfo(payloadData.document_info || null);
         setPhase(3); // fallback if not logged in
         setIsGenerating(false);
         return;
      }
      
      const postResponse = await axios.post("http://127.0.0.1:8000/api/flashcard-sets/", postPayload);
      navigate(`/study/${postResponse.data.id}`); // zero-click seamless redirect natively!
      
    } catch (err) {
      console.error("Generation/Save error:", err);
      setError(err.response?.data?.detail || "Failed to generate or save study materials.");
      setIsGenerating(false);
    }
  };

  const toggleModule = (id) => {
    setSelectedModules(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const resetSession = () => {
    setPhase(1);
    setCompleteStudySet(null);
    setFlashcards([]);
    setDocumentInfo(null);
    setError("");
    setSaved(false);
    setExtractedData(null);
  };

  const saveSet = async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (!setTitle.trim()) return;

    setSaving(true);
    try {
      const postPayload = {
        title: setTitle,
        flashcards: completeStudySet?.flashcards || [],
        summary: completeStudySet?.summary || "",
        key_points: completeStudySet?.key_points || [],
        quiz: completeStudySet?.quiz || [],
        fill_blanks: completeStudySet?.fill_blanks || [],
        short_questions: completeStudySet?.short_questions || [],
        true_false: completeStudySet?.true_false || [],
        definitions: completeStudySet?.definitions || [],
        tutor_lesson: completeStudySet?.tutor_lesson || null,
        raw_content: completeStudySet?.raw_content || null,
        selected_modules: selectedModules
      };
      
      const postResponse = await axios.post("http://127.0.0.1:8000/api/flashcard-sets/", postPayload);
      setSavedSetId(postResponse.data.id);
      setSaved(true);
    } catch (err) {
      console.error(err);
      alert("Failed to save flashcard set.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-8 flex flex-col items-center bg-brand-bg">
      <motion.header
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
        className="w-full max-w-7xl mx-auto flex flex-col items-center text-center mb-12"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-brand-primary/20 rounded-2xl glass-panel shadow-[0_0_15px_rgba(139,92,246,0.3)] cursor-pointer" onClick={() => navigate(user ? "/dashboard" : "/")}>
            <BrainCircuit className="w-8 h-8 text-brand-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Learn<span className="gradient-text-primary">AID</span></h1>
        </div>
        <p className="text-brand-muted max-w-xl text-lg">Build precisely the study tools you need from your raw materials.</p>
      </motion.header>

      <main className="w-full max-w-7xl mx-auto flex-1 flex flex-col items-center justify-center relative">
        <AnimatePresence mode="wait">
          {phase === 1 && (
            <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -20 }} className="w-full flex items-center justify-center min-h-[50vh]">
               <UploadSection onUploadFile={handleFileUpload} onUploadUrl={handleUrlSubmit} isGenerating={isGenerating} error={error} />
            </motion.div>
          )}

          {phase === 2 && (
            <motion.div key="select" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full max-w-4xl">
               <div className="glass-panel p-8 rounded-[2rem] border border-brand-border">
                  <h2 className="text-3xl font-bold mb-2">Configure Your Learning Material</h2>
                  <p className="text-brand-muted mb-8 text-lg">Select exactly which modes LearnAID should generate from your upload. Only chosen formats will be processed.</p>
                  
                  {error && <div className="p-4 mb-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">{error}</div>}

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                     {allModules.map((mod) => {
                        const isSelected = selectedModules.includes(mod.id);
                        return (
                           <div 
                              key={mod.id} 
                              onClick={() => toggleModule(mod.id)}
                              className={`p-4 rounded-2xl border-2 cursor-pointer flex flex-col items-center justify-center text-center transition-all ${isSelected ? 'border-brand-primary bg-brand-primary/10 scale-[1.02]' : 'border-brand-border bg-brand-surface hover:border-brand-primary/50 text-brand-muted'}`}
                           >
                              <div className={`w-10 h-10 mb-3 rounded-full flex items-center justify-center ${isSelected ? 'bg-brand-primary text-white' : 'bg-brand-bg'}`}>
                                 {mod.icon}
                              </div>
                              <span className={`font-semibold ${isSelected ? 'text-brand-text' : ''}`}>{mod.label}</span>
                           </div>
                        );
                     })}
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-6 border-t border-brand-border pt-8">
                     <button onClick={resetSession} className="px-6 py-3 text-brand-muted hover:text-white transition-colors">Cancel</button>
                     <button onClick={executeGeneration} disabled={isGenerating} className="w-full sm:w-auto px-8 py-4 bg-brand-primary text-white rounded-xl font-bold flex items-center justify-center gap-3 hover:scale-105 transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)]">
                        {isGenerating ? <><Loader2 className="w-5 h-5 animate-spin" /> Processing AI...</> : <><BrainCircuit className="w-5 h-5"/> Generate Modules</>}
                     </button>
                  </div>
               </div>
            </motion.div>
          )}

          {phase === 3 && (
            <motion.div key="results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full">
              <div className="mb-8 flex flex-col sm:flex-row items-center gap-4 p-4 glass-panel border border-brand-border rounded-2xl justify-between w-full">
                <input type="text" value={setTitle} onChange={(e) => setSetTitle(e.target.value)} className="bg-brand-bg px-4 py-2 rounded-xl border border-brand-border focus:border-brand-primary outline-none flex-1 w-full" placeholder="Set Title" />
                <div className="flex gap-3 w-full sm:w-auto">
                  {saved ? (
                    <button disabled className="px-6 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-xl font-medium flex items-center gap-2 justify-center w-full sm:w-auto"><Check className="w-4 h-4" /> Saved!</button>
                  ) : (
                    <button onClick={saveSet} disabled={saving} className="px-6 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl font-medium flex items-center gap-2 justify-center w-full sm:w-auto transition-all">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Set
                    </button>
                  )}
                  {user && savedSetId && (
                    <button onClick={() => navigate(`/study/${savedSetId}`)} className="px-4 py-2 bg-brand-text text-brand-bg hover:scale-105 rounded-xl whitespace-nowrap transition-transform flex items-center gap-2 font-bold focus:outline-none">
                      Go To Study <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full">
                <div className="lg:col-span-1 border border-brand-border rounded-3xl p-6 bg-brand-surface flex justify-center text-center flex-col items-center">
                  <h3 className="text-xl font-bold mb-4">Generation Complete</h3>
                  <p className="text-brand-muted">Your requested modules have been specifically compiled. Click "Save Set" to proceed to the Study Mode Environment where they will be loaded natively.</p>
                </div>
                <div className="lg:col-span-2">
                  <FlashcardList completeStudySet={completeStudySet} flashcards={flashcards} setFlashcards={setFlashcards} onReset={resetSession} savedSetId={savedSetId} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
