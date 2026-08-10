import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, FileText, X, Sparkles, Loader2, AlertCircle, Link as LinkIcon, Mic, Camera, Image as ImageIcon, Square, Play } from 'lucide-react';

export default function UploadSection({ onUploadFile, onUploadUrl, onUploadAudio, onUploadOcr, isGenerating, error }) {
  const [activeTab, setActiveTab] = useState('pdf'); // 'pdf', 'url', 'audio', 'ocr'
  const [cardType] = useState('Standard Q&A');
  const [dragActive, setDragActive] = useState(false);
  
  // States for different tabs
  const [selectedFile, setSelectedFile] = useState(null);
  const [urlInput, setUrlInput] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  
  // Audio Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const timerIntervalRef = useRef(null);
  
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [isRecording]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDropPdf = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };
  
  const handleDropImage = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelection = (file) => {
    const allowedExts = ['pdf', 'docx', 'pptx', 'txt'];
    const ext = file.name.split('.').pop().toLowerCase();
    if (!allowedExts.includes(ext)) {
      alert("Please upload a PDF, DOCX, PPTX, or TXT file.");
      return;
    }
    setSelectedFile(file);
  };

  const handleImageSelection = (file) => {
    if (!file.type.startsWith('image/')) {
      alert("Please upload a valid image file.");
      return;
    }
    setSelectedImage(file);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
        clearInterval(timerIntervalRef.current);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setAudioBlob(null);
      setRecordingTime(0);
      
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };
  
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleSubmit = () => {
    if (activeTab === 'pdf' && selectedFile) {
      onUploadFile(selectedFile, cardType);
    } else if (activeTab === 'url' && urlInput.trim()) {
      onUploadUrl(urlInput.trim(), cardType);
    } else if (activeTab === 'audio' && audioBlob) {
      // Create a File object from Blob to pass along
      const file = new File([audioBlob], "live_lecture.webm", { type: 'audio/webm' });
      onUploadAudio(file, cardType);
    } else if (activeTab === 'ocr' && selectedImage) {
      onUploadOcr(selectedImage, cardType);
    }
  };

  const isSubmitDisabled = 
    isGenerating ||
    (activeTab === 'pdf' && !selectedFile) || 
    (activeTab === 'url' && !urlInput.trim()) || 
    (activeTab === 'audio' && (!audioBlob || isRecording)) ||
    (activeTab === 'ocr' && !selectedImage);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-2xl flex flex-col gap-6"
    >
      {/* Tabs */}
      <div className="flex bg-brand-surface p-1 rounded-2xl border border-brand-border w-fit mx-auto overflow-x-auto max-w-full no-scrollbar">
        {[
          { id: 'pdf', label: 'Document', icon: <FileText className="w-4 h-4 mr-2 hidden sm:block" /> },
          { id: 'url', label: 'Link', icon: <LinkIcon className="w-4 h-4 mr-2 hidden sm:block" /> },
          { id: 'audio', label: 'Live Audio', icon: <Mic className="w-4 h-4 mr-2 hidden sm:block" /> },
          { id: 'ocr', label: 'Handwriting', icon: <Camera className="w-4 h-4 mr-2 hidden sm:block" /> }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center whitespace-nowrap px-4 sm:px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.id ? 'bg-brand-primary text-white shadow-lg' : 'text-brand-muted hover:bg-brand-border/50 hover:text-brand-text'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div
        className={`glass-panel rounded-3xl p-10 border-2 transition-all duration-300 flex flex-col items-center justify-center text-center relative overflow-hidden ${
          (activeTab === 'pdf' || activeTab === 'ocr') && dragActive ? 'border-brand-primary bg-brand-primary/5' : 'border-dashed border-brand-border/80 hover:border-brand-primary/50'
        }`}
        onDragEnter={(activeTab === 'pdf' || activeTab === 'ocr') ? handleDrag : undefined}
        onDragLeave={(activeTab === 'pdf' || activeTab === 'ocr') ? handleDrag : undefined}
        onDragOver={(activeTab === 'pdf' || activeTab === 'ocr') ? handleDrag : undefined}
        onDrop={activeTab === 'pdf' ? handleDropPdf : activeTab === 'ocr' ? handleDropImage : undefined}
      >
        <AnimatePresence mode="wait">
          {activeTab === 'pdf' && (
            <motion.div
              key="pdf-tab"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              className="w-full flex justify-center"
              onClick={() => !selectedFile && fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" accept=".pdf,.docx,.pptx,.txt" onChange={(e) => e.target.files?.[0] && handleFileSelection(e.target.files[0])} className="hidden" />
              {!selectedFile ? (
                <div className="flex flex-col items-center cursor-pointer pointer-events-none">
                  <div className="w-16 h-16 rounded-full bg-brand-surface border border-brand-border flex items-center justify-center mb-6 shadow-lg">
                    <UploadCloud className="w-8 h-8 text-brand-primary" />
                  </div>
                  <h3 className="text-xl font-medium mb-2">Drag & Drop your Document</h3>
                  <p className="text-brand-muted mb-6">Supports PDF, DOCX, PPTX, TXT</p>
                  <div className="px-8 py-3 rounded-full bg-brand-primary text-white text-sm font-semibold shadow-md pointer-events-auto">Select Document</div>
                </div>
              ) : (
                <div className="w-full flex items-center gap-4 p-4 rounded-2xl bg-brand-surface/80 border border-brand-border relative z-10 cursor-default">
                  <div className="p-3 bg-brand-bg rounded-xl"><FileText className="w-8 h-8 text-[#A78BFA]" /></div>
                  <div className="flex-1 text-left overflow-hidden">
                    <h4 className="font-medium truncate text-brand-text">{selectedFile.name}</h4>
                    <p className="text-xs text-brand-muted">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  {!isGenerating && (
                    <button onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }} className="p-2 text-brand-muted hover:text-brand-text hover:bg-brand-bg rounded-full transition-colors"><X className="w-5 h-5" /></button>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'url' && (
            <motion.div
              key="url-tab"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="w-full flex justify-center py-6"
            >
              <div className="w-full max-w-lg flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-brand-surface border border-brand-border flex items-center justify-center mb-6 shadow-lg">
                  <LinkIcon className="w-8 h-8 text-brand-primary" />
                </div>
                <h3 className="text-xl font-medium mb-2">Paste a Web Link</h3>
                <p className="text-brand-muted mb-6 text-sm">Supports YouTube Videos & most articles</p>
                <div className="w-full relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><LinkIcon className="h-5 w-5 text-brand-muted" /></div>
                  <input type="url" placeholder="https://en.wikipedia.org/wiki/Quantum_mechanics" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} className="block w-full pl-11 pr-4 py-4 bg-brand-surface border-2 border-brand-border rounded-xl focus:border-brand-primary outline-none transition-all" />
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'audio' && (
            <motion.div
              key="audio-tab"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="w-full flex justify-center py-6"
            >
              <div className="w-full max-w-lg flex flex-col items-center text-center">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-lg transition-all ${isRecording ? 'bg-red-500/20 border-2 border-red-500 animate-pulse' : 'bg-brand-surface border border-brand-border'}`}>
                  <Mic className={`w-10 h-10 ${isRecording ? 'text-red-500' : 'text-brand-primary'}`} />
                </div>
                <h3 className="text-xl font-medium mb-2">{isRecording ? "Recording Live Lecture..." : "Record Live Lecture"}</h3>
                <p className="text-brand-muted mb-8 text-sm">{isRecording ? formatTime(recordingTime) : "Tap to transcribe speech into study notes instantly."}</p>
                
                {isRecording ? (
                  <button onClick={stopRecording} className="px-8 py-3 rounded-full bg-red-500 text-white font-bold flex items-center gap-2 hover:bg-red-600 transition-all">
                    <Square className="w-4 h-4 fill-current" /> Stop Recording
                  </button>
                ) : audioBlob ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="px-4 py-2 bg-green-500/20 text-green-400 rounded-xl font-medium text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4" /> Audio ready ({formatTime(recordingTime)})
                    </div>
                    <button onClick={startRecording} className="text-sm text-brand-primary hover:underline">Record Again</button>
                  </div>
                ) : (
                  <button onClick={startRecording} className="px-8 py-3 rounded-full bg-brand-primary text-white font-bold flex items-center gap-2 hover:bg-brand-primary-hover transition-all shadow-md">
                    <Play className="w-4 h-4 fill-current" /> Start Recording
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'ocr' && (
            <motion.div
              key="ocr-tab"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="w-full flex justify-center py-4"
              onClick={() => !selectedImage && imageInputRef.current?.click()}
            >
              <input ref={imageInputRef} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleImageSelection(e.target.files[0])} className="hidden" capture="environment" />
              {!selectedImage ? (
                <div className="flex flex-col items-center cursor-pointer pointer-events-none">
                  <div className="w-16 h-16 rounded-full bg-brand-surface border border-brand-border flex items-center justify-center mb-6 shadow-lg">
                    <Camera className="w-8 h-8 text-brand-primary" />
                  </div>
                  <h3 className="text-xl font-medium mb-2">Snap Handwritten Notes</h3>
                  <p className="text-brand-muted mb-6 text-sm">Supports PNG, JPG (Take a photo or upload)</p>
                  <div className="px-8 py-3 rounded-full bg-brand-primary text-white text-sm font-semibold shadow-md pointer-events-auto">Choose Image</div>
                </div>
              ) : (
                <div className="w-full flex flex-col items-center z-10 cursor-default">
                  <div className="w-full flex items-center gap-4 p-4 rounded-2xl bg-brand-surface/80 border border-brand-border relative">
                    <div className="p-3 bg-brand-bg rounded-xl"><ImageIcon className="w-8 h-8 text-blue-400" /></div>
                    <div className="flex-1 text-left overflow-hidden">
                      <h4 className="font-medium truncate text-brand-text">{selectedImage.name}</h4>
                      <p className="text-xs text-brand-muted">{(selectedImage.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    {!isGenerating && (
                      <button onClick={(e) => { e.stopPropagation(); setSelectedImage(null); }} className="p-2 text-brand-muted hover:text-brand-text hover:bg-brand-bg rounded-full transition-colors"><X className="w-5 h-5" /></button>
                    )}
                  </div>
                  {/* Small preview */}
                  <img src={URL.createObjectURL(selectedImage)} alt="Preview" className="w-32 h-32 object-cover rounded-xl mt-4 border-2 border-brand-border" />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {isGenerating && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="absolute inset-0 bg-brand-surface/90 backdrop-blur-md z-20 flex flex-col items-center justify-center rounded-3xl"
          >
            <Loader2 className="w-10 h-10 text-brand-primary animate-spin mb-4" />
            <p className="text-lg font-medium animate-pulse">Extracting Knowledge...</p>
            <p className="text-sm text-brand-muted mt-2">AI is analyzing your input...</p>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={!isSubmitDisabled ? { scale: 1.02 } : {}}
        whileTap={!isSubmitDisabled ? { scale: 0.98 } : {}}
        onClick={handleSubmit}
        disabled={isSubmitDisabled}
        className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${
            !isSubmitDisabled
            ? 'bg-brand-primary hover:bg-brand-primary-hover text-white shadow-[0_0_20px_rgba(139,92,246,0.4)]'
            : 'bg-brand-surface text-brand-muted border border-brand-border cursor-not-allowed opacity-70'
          }`}
      >
        {isGenerating ? (
          <><Sparkles className="w-5 h-5" /> Generating Study Modes...</>
        ) : (
          <><Sparkles className="w-5 h-5" /> Generate Study Modes</>
        )}
      </motion.button>
    </motion.div>
  );
}
