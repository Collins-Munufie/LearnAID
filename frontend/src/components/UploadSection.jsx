import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, FileText, X, Sparkles, Loader2, AlertCircle, Link as LinkIcon } from 'lucide-react';

export default function UploadSection({ onUploadFile, onUploadUrl, isGenerating, error }) {
  const [activeTab, setActiveTab] = useState('pdf'); // 'pdf' or 'url'
  const [cardType, setCardType] = useState('Standard Q&A');
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0]);
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

  const handleSubmit = () => {
    if (activeTab === 'pdf' && selectedFile) {
      onUploadFile(selectedFile, cardType);
    } else if (activeTab === 'url' && urlInput.trim()) {
      onUploadUrl(urlInput.trim(), cardType);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-2xl flex flex-col gap-6"
    >
      {/* Tabs */}
      <div className="flex bg-brand-surface p-1 rounded-2xl border border-brand-border w-fit mx-auto">
        <button
          onClick={() => setActiveTab('pdf')}
          className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'pdf' ? 'bg-brand-primary text-white shadow-lg' : 'text-brand-muted hover:text-white'
          }`}
        >
          Upload Document
        </button>
        <button
          onClick={() => setActiveTab('url')}
          className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'url' ? 'bg-brand-primary text-white shadow-lg' : 'text-brand-muted hover:text-white'
          }`}
        >
          Web / YouTube Link
        </button>
      </div>

      <div 
        className={`glass-panel rounded-3xl p-10 border-2 transition-all duration-300 flex flex-col items-center justify-center text-center relative overflow-hidden ${
          activeTab === 'pdf' && dragActive ? 'border-brand-primary bg-brand-primary/5' : 'border-dashed border-brand-border/80 hover:border-brand-primary/50'
        }`}
        onDragEnter={activeTab === 'pdf' ? handleDrag : undefined}
        onDragLeave={activeTab === 'pdf' ? handleDrag : undefined}
        onDragOver={activeTab === 'pdf' ? handleDrag : undefined}
        onDrop={activeTab === 'pdf' ? handleDrop : undefined}
      >
        <AnimatePresence mode="wait">
          {activeTab === 'pdf' ? (
            <motion.div 
              key="pdf-tab"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="w-full flex justify-center"
              onClick={() => !selectedFile && fileInputRef.current?.click()}
            >
              <input 
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.pptx,.txt"
                onChange={handleChange}
                className="hidden"
              />

              {!selectedFile ? (
                <div className="flex flex-col items-center cursor-pointer pointer-events-none">
                  <div className="w-16 h-16 rounded-full bg-brand-surface border border-brand-border flex items-center justify-center mb-6 shadow-lg">
                    <UploadCloud className="w-8 h-8 text-brand-primary" />
                  </div>
                  <h3 className="text-xl font-medium mb-2">Drag & Drop your Document</h3>
                  <p className="text-brand-muted mb-6">Supports PDF, DOCX, PPTX, TXT</p>
                  <div className="px-6 py-2.5 rounded-full bg-brand-surface border border-brand-border text-sm font-medium hover:bg-brand-primary/10 transition-colors pointer-events-auto">
                    Select Document
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center w-full z-10 cursor-default">
                  <div className="w-full flex items-center gap-4 p-4 rounded-2xl bg-brand-surface/80 border border-brand-border relative">
                    <div className="p-3 bg-brand-bg rounded-xl">
                      <FileText className="w-8 h-8 text-[#A78BFA]" />
                    </div>
                    <div className="flex-1 text-left overflow-hidden">
                      <h4 className="font-medium truncate text-brand-text">{selectedFile.name}</h4>
                      <p className="text-xs text-brand-muted">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    {!isGenerating && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                        className="p-2 text-brand-muted hover:text-brand-text hover:bg-brand-bg rounded-full transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="url-tab"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full flex justify-center py-6"
            >
              <div className="w-full max-w-lg flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-brand-surface border border-brand-border flex items-center justify-center mb-6 shadow-lg">
                  <LinkIcon className="w-8 h-8 text-brand-primary" />
                </div>
                <h3 className="text-xl font-medium mb-2">Paste a Web Link</h3>
                <p className="text-brand-muted mb-6 text-sm">Supports YouTube Videos & most articles</p>
                
                <div className="w-full relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <LinkIcon className="h-5 w-5 text-brand-muted" />
                  </div>
                  <input
                    type="url"
                    placeholder="https://en.wikipedia.org/wiki/Quantum_mechanics"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="block w-full pl-11 pr-4 py-4 bg-brand-bg border border-brand-border rounded-xl focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary text-brand-text placeholder-brand-border outline-none transition-all"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isGenerating && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-brand-surface/90 backdrop-blur-md z-20 flex flex-col items-center justify-center rounded-3xl"
          >
            <Loader2 className="w-10 h-10 text-brand-primary animate-spin mb-4" />
            <p className="text-lg font-medium animate-pulse">Extracting Knowledge...</p>
            <p className="text-sm text-brand-muted mt-2">AI is analyzing your {activeTab === 'pdf' ? 'document' : 'link'}</p>
          </motion.div>
        )}
      </div>
      
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleSubmit}
        disabled={(activeTab === 'pdf' && !selectedFile) || (activeTab === 'url' && !urlInput.trim()) || isGenerating}
        className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${
          ((activeTab === 'pdf' && selectedFile) || (activeTab === 'url' && urlInput.trim())) && !isGenerating
            ? 'bg-brand-primary hover:bg-brand-primary-hover text-white shadow-[0_0_20px_rgba(139,92,246,0.4)]'
            : 'bg-brand-surface text-brand-muted border border-brand-border cursor-not-allowed opacity-70'
        }`}
      >
        {isGenerating ? (
          <>
            Generating Flashcards...
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            Generate Flashcards
          </>
        )}
      </motion.button>
    </motion.div>
  );
}
