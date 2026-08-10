import { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Loader2, Target, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

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
      const response = await axios.post("/api/socratic-tutor", {
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
          <div className="flex bg-brand-surface p-4 border-b border-brand-border items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-primary/20 rounded-full flex items-center justify-center">
                <Bot className="w-6 h-6 text-brand-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-brand-text">Socratic AI Tutor</h3>
                <p className="text-xs text-brand-muted">Guiding you to the answer</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-brand-primary/10 rounded-full text-brand-muted hover:text-brand-primary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Question Banner */}
          <div className="bg-brand-primary/5 border-b border-brand-border p-4 text-sm flex gap-3">
             <Target className="w-5 h-5 text-brand-primary shrink-0" />
             <div className="text-brand-text font-medium leading-relaxed">
               {question}
             </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-brand-bg">
            {messages.map(msg => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={msg.id} 
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`px-4 py-3 max-w-[85%] rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.sender === 'user' 
                    ? 'bg-brand-primary text-white rounded-br-sm' 
                    : 'bg-brand-surface border border-brand-border text-brand-text rounded-bl-sm'
                }`}>
                  {msg.text}
                </div>
              </motion.div>
            ))}
            {isTyping && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                 <div className="px-4 py-3 bg-brand-surface border border-brand-border rounded-2xl rounded-bl-sm flex items-center gap-2 text-brand-primary">
                    <Loader2 className="w-4 h-4 animate-spin" /> <span className="text-xs font-medium">Analyzing your logic...</span>
                 </div>
              </motion.div>
            )}
            <div ref={endOfMessagesRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-brand-border bg-brand-surface">
            <div className="flex items-center gap-2 mb-2 px-1 opacity-70">
              <Info className="w-3.5 h-3.5 text-brand-muted" />
              <span className="text-xs text-brand-muted">The AI won't give you the exact answer directly.</span>
            </div>
            <div className="relative flex items-center">
              <input 
                type="text" 
                placeholder="Type your thoughts here..." 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                className="w-full bg-brand-bg border border-brand-border rounded-xl pl-4 pr-12 py-3 text-sm focus:border-brand-primary outline-none transition-all text-brand-text placeholder-brand-muted/50"
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="absolute right-2 p-2 text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
