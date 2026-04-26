import { useState, useRef, useEffect } from 'react';
import { Bot, Send, BrainCircuit, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import axios from 'axios';

export default function StudyChat({ rawContent }) {
  const [messages, setMessages] = useState([
    { id: 1, text: "Here to help you learn! Ask me anything about the material.", sender: 'ai' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const endOfMessagesRef = useRef(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    
    const userMessage = { id: Date.now(), text: input, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);
    
    try {
      const response = await axios.post("http://127.0.0.1:8000/api/chat", {
         messages: [...messages, userMessage],
         context_text: rawContent || "No context provided."
      });
      
      setMessages(prev => [...prev, { id: Date.now() + 1, text: response.data.response, sender: 'ai' }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { id: Date.now() + 1, text: "I'm having trouble connecting to the network right now. Please try again later.", sender: 'ai' }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] w-full w-80 lg:w-96 glass-panel border border-brand-border rounded-3xl overflow-hidden sticky top-8">
      <div className="flex bg-brand-surface p-4 border-b border-brand-border items-center gap-3">
        <Bot className="w-6 h-6 text-brand-primary" />
        <h3 className="font-semibold">AI Study Assistant</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
           <div className="h-full flex flex-col items-center justify-center text-brand-muted opacity-50">
             <BrainCircuit className="w-12 h-12 mb-2" />
             <p className="text-sm">Ask me anything</p>
           </div>
        )}
        {messages.map(msg => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={msg.id} 
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`px-4 py-2 max-w-[85%] rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
              msg.sender === 'user' ? 'bg-brand-primary text-white rounded-br-sm' : 'bg-brand-surface border border-brand-border rounded-bl-sm'
            }`}>
              {msg.text}
            </div>
          </motion.div>
        ))}
        {isTyping && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
             <div className="px-4 py-3 bg-brand-surface border border-brand-border rounded-2xl rounded-bl-sm flex items-center gap-2 text-brand-primary">
                <Loader2 className="w-4 h-4 animate-spin" /> <span className="text-xs font-medium">Thinking...</span>
             </div>
          </motion.div>
        )}
        <div ref={endOfMessagesRef} />
      </div>

      <div className="p-4 border-t border-brand-border bg-brand-bg">
        <div className="relative flex items-center">
          <input 
            type="text" 
            placeholder="Ask me anything..." 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="w-full bg-brand-surface border border-brand-border rounded-xl pl-4 pr-12 py-3 text-sm focus:border-brand-primary outline-none transition-all"
          />
          <button 
            onClick={handleSend}
            className="absolute right-2 p-2 text-brand-muted hover:text-brand-primary transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
