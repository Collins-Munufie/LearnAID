import { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Loader2, Target, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api';

export default function SocraticTutorModal({ isOpen, onClose, question, correctAnswer, contextText }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const endOfMessagesRef = useRef(null);

  // Initialize chat when modal opens or question changes
  useEffect(() => {
    if (isOpen && question) {
      setMessages([
        { 
          id: Date.now(), 
          text: `I see you're working on: "${question}". Let's figure this out together! What are your initial thoughts?`, 
          sender: 'ai' 
        }
      ]);
      setInput('');
      setIsTyping(false);
    }
  }, [isOpen, question]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    
    const userMessage = { id: Date.now(), text: input, sender: 'user' };
    const currentMessages = [...messages, userMessage];
    
    setMessages(currentMessages);
    setInput('');
    setIsTyping(true);
    
    try {
      const response = await api.post("/api/socratic-tutor", {
         question: question,
         correct_answer: correctAnswer,
         messages: currentMessages,
         context_text: contextText || "No context provided."
      });
      
      setMessages(prev => [...prev, { id: Date.now() + 1, text: response.data.response, sender: 'ai' }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { id: Date.now() + 1, text: "I'm having trouble connecting to the network right now. Please try again later.", sender: 'ai' }]);
    } finally {
      setIsTyping(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-brand-bg border border-brand-border rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="flex bg-brand-surface p-5 border-b border-brand-border items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-brand-primary/20 to-purple-500/10 rounded-2xl flex items-center justify-center border border-brand-primary/20 shadow-inner">
                <Bot className="w-6 h-6 text-brand-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-brand-text tracking-tight">Socratic AI Tutor</h3>
                <p className="text-[11px] text-brand-primary uppercase tracking-wider font-semibold">Guiding you to the answer</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2.5 bg-brand-bg hover:bg-brand-primary/10 border border-brand-border rounded-xl text-brand-muted hover:text-brand-primary transition-all active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Question Banner */}
          <div className="bg-brand-primary/5 border-b border-brand-primary/10 p-4 text-sm flex items-start gap-3 shadow-inner">
             <Target className="w-5 h-5 text-brand-primary shrink-0 mt-0.5" />
             <div className="text-brand-text font-medium leading-relaxed">
               {question}
             </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-brand-bg/50">
            {messages.map((msg, idx) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                key={msg.id} 
                className={`flex w-full ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex max-w-[85%] sm:max-w-[75%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'} gap-3 items-end`}>
                  {msg.sender === 'ai' && (
                    <div className="w-8 h-8 rounded-full bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center shrink-0 mb-1">
                      <Bot className="w-4 h-4 text-brand-primary" />
                    </div>
                  )}
                  <div className={`px-5 py-3.5 text-[15px] leading-relaxed shadow-sm ${
                    msg.sender === 'user' 
                      ? 'bg-brand-primary text-white rounded-2xl rounded-br-sm' 
                      : 'bg-brand-surface border border-brand-border text-brand-text rounded-2xl rounded-bl-sm shadow-[0_4px_20px_rgba(0,0,0,0.05)]'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              </motion.div>
            ))}
            {isTyping && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start items-end gap-3 w-full">
                 <div className="w-8 h-8 rounded-full bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center shrink-0 mb-1">
                   <Bot className="w-4 h-4 text-brand-primary" />
                 </div>
                 <div className="px-5 py-3.5 bg-brand-surface border border-brand-border rounded-2xl rounded-bl-sm flex items-center gap-3 text-brand-primary shadow-sm">
                    <Loader2 className="w-5 h-5 animate-spin" /> <span className="text-sm font-medium">Analyzing your logic...</span>
                 </div>
              </motion.div>
            )}
            <div ref={endOfMessagesRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 sm:p-5 border-t border-brand-border bg-brand-surface shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
            <div className="flex items-center gap-2 mb-3 px-2">
              <Info className="w-3.5 h-3.5 text-brand-primary/80" />
              <span className="text-xs font-medium text-brand-muted">The AI won't give you the exact answer directly.</span>
            </div>
            <div className="relative flex items-center group">
              <input 
                type="text" 
                placeholder="Type your thoughts here..." 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                className="w-full bg-brand-bg border-2 border-brand-border rounded-2xl pl-5 pr-14 py-4 text-[15px] focus:border-brand-primary outline-none transition-all text-brand-text placeholder-brand-muted/50 group-hover:border-brand-border/80"
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="absolute right-2 p-3 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl transition-all disabled:opacity-40 disabled:hover:bg-brand-primary active:scale-95 shadow-md flex items-center justify-center"
              >
                <Send className="w-5 h-5 ml-0.5" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
