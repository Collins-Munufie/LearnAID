import { useState, useRef, useEffect } from 'react';
import { Bot, Send, BrainCircuit, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import api, { getErrorMessage } from '../lib/api';

export default function StudyChat({ rawContent, initialQuery, onClearQuery, className = "h-[calc(100vh-6rem)] w-80 lg:w-96 glass-panel border border-brand-border rounded-3xl sticky top-8" }) {
  const [messages, setMessages] = useState([
    { id: 1, text: "Here to help you learn! Ask me anything about the material.", sender: 'ai' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const endOfMessagesRef = useRef(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (initialQuery && initialQuery.trim() !== "") {
      const sendQuery = async () => {
        const userMessage = { id: Date.now(), text: initialQuery, sender: 'user' };
        setMessages(prev => [...prev, userMessage]);
        setIsTyping(true);
        
        if (onClearQuery) {
          onClearQuery();
        }

        try {
          const response = await api.post("/api/chat", {
             messages: [{ id: 1, text: "Here to help you learn! Ask me anything about the material.", sender: 'ai' }, userMessage],
             context_text: rawContent || "No context provided."
          }, { longRunning: true });
          
          setMessages(prev => [...prev, { id: Date.now() + 1, text: response.data.response, sender: 'ai' }]);
        } catch (err) {
          console.error(err);
          setMessages(prev => [...prev, { id: Date.now() + 1, text: getErrorMessage(err, "I'm having trouble connecting right now. Please try again later."), sender: 'ai' }]);
        } finally {
          setIsTyping(false);
        }
      };
      sendQuery();
    }
  }, [initialQuery, rawContent, onClearQuery]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    
    const userMessage = { id: Date.now(), text: input, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);
    
    try {
      const response = await api.post("/api/chat", {
         messages: [...messages, userMessage],
         context_text: rawContent || "No context provided."
      }, { longRunning: true });
      
      setMessages(prev => [...prev, { id: Date.now() + 1, text: response.data.response, sender: 'ai' }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { id: Date.now() + 1, text: getErrorMessage(err, "I'm having trouble connecting right now. Please try again later."), sender: 'ai' }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className={`flex flex-col overflow-hidden bg-brand-bg shadow-[0_0_40px_rgba(0,0,0,0.05)] ${className}`}>
      {/* Header */}
      <div className="flex bg-brand-surface p-5 border-b border-brand-border items-center gap-4 shadow-sm">
        <div className="w-12 h-12 bg-gradient-to-br from-brand-primary/20 to-purple-500/10 rounded-2xl flex items-center justify-center border border-brand-primary/20 shadow-inner">
          <Bot className="w-6 h-6 text-brand-primary" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-brand-text tracking-tight">AI Study Assistant</h3>
          <p className="text-[11px] text-brand-primary uppercase tracking-wider font-semibold">Your Personal AI Tutor</p>
        </div>
      </div>
      
      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-brand-bg/50">
        {messages.length === 0 && (
           <div className="h-full flex flex-col items-center justify-center text-brand-muted opacity-60">
             <div className="w-16 h-16 bg-brand-primary/10 rounded-full flex items-center justify-center mb-4 border border-brand-primary/20">
                <BrainCircuit className="w-8 h-8 text-brand-primary" />
             </div>
             <p className="text-sm font-semibold tracking-wide">Ask me anything about the material</p>
           </div>
        )}
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
                <Loader2 className="w-5 h-5 animate-spin" /> <span className="text-sm font-medium">Thinking...</span>
             </div>
          </motion.div>
        )}
        <div ref={endOfMessagesRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 sm:p-5 border-t border-brand-border bg-brand-surface shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
        <div className="relative flex items-center group">
          <input 
            type="text" 
            placeholder="Ask me anything..." 
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
    </div>
  );
}
