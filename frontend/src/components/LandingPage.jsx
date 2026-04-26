import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { BrainCircuit, Upload, Link as LinkIcon, FileText, PlayCircle, ArrowRight, Zap, Target, BookOpen, ChevronDown, CheckCircle2, Star, Sparkles } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState(null);

  const features = [
    {
      icon: <Zap className="w-8 h-8 text-brand-primary" />,
      title: "Instant Generation",
      description: "Skip hours of manual typing. Let AI extract every crucial concept from your material and spin it into multiple study formats instantly."
    },
    {
      icon: <Layers className="w-8 h-8 text-blue-400" />,
      title: "Multi-Modal Learning",
      description: "Don't just stare at flashcards. We generate True/False assessments, Fill-in-the-Blanks, Quizzes, and Definition libraries simultaneously."
    },
    {
      icon: <Target className="w-8 h-8 text-green-400" />,
      title: "Adaptive Mastery",
      description: "Our Spaced Repetition engine algorithmically tracks your exact accuracy across quizzes and cards to guarantee exam readiness."
    }
  ];

  const faqs = [
    {
      q: "What file types are supported?",
      a: "LearnAID seamlessly parses PDF documents, Word files (.docx), simple text inputs, and even automatically extracts transcripts directly from YouTube URLs."
    },
    {
      q: "Are the generated flashcards accurate?",
      a: "Yes! Utilizing advanced Large Language Models, the engine strictly bounds its responses exclusively to the context of the material you upload, avoiding hallucinations."
    },
    {
      q: "Can I track my progress over time?",
      a: "Absolutely. The Command Center dashboard precisely tracks which topics you've Mastered vs which topics you are Unfamiliar with, logging your exact quiz accuracies."
    }
  ];

  const steps = [
    { num: "01", title: "Upload Your Content", text: "Drag and drop your lecture slides, notes, or paste a video link." },
    { num: "02", title: "AI Extraction", text: "Our processor automatically isolates the highest yield concepts." },
    { num: "03", title: "Start Mastering", text: "Test yourself using our unified suite of active-recall metrics." }
  ];

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text font-sans selection:bg-brand-primary/30">
      
      {/* NAVBAR */}
      <nav className="fixed w-full z-50 top-0 border-b border-brand-border bg-brand-bg/80 backdrop-blur-xl">
         <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo(0,0)}>
               <div className="p-2.5 bg-brand-primary/20 rounded-xl shadow-[0_0_15px_rgba(139,92,246,0.3)]">
                 <BrainCircuit className="w-6 h-6 text-brand-primary" />
               </div>
               <span className="text-2xl font-bold tracking-tight">Learn<span className="text-brand-primary">AID</span></span>
            </div>
            
            <div className="flex gap-4">
               <button onClick={() => navigate('/login')} className="px-5 py-2.5 text-brand-muted hover:text-white font-medium transition-colors hidden sm:block">Log In</button>
               <button onClick={() => navigate('/login')} className="px-6 py-2.5 bg-brand-text text-brand-bg hover:bg-brand-primary hover:text-white rounded-xl font-bold transition-all shadow-lg hover:scale-105">Get Started</button>
            </div>
         </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative pt-40 pb-20 px-6 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-primary/10 rounded-full blur-[120px] pointer-events-none"></div>
        
        <div className="max-w-5xl mx-auto text-center relative z-10">
           <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-brand-primary/30 bg-brand-primary/10 text-brand-primary font-medium text-sm mb-8 shadow-[0_0_20px_rgba(139,92,246,0.15)] transform hover:scale-105 transition-transform cursor-pointer" onClick={() => navigate('/generate')}>
                 <Sparkles className="w-4 h-4"/> Unleash AI-Powered Studying
              </div>
              
              <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
                 Master Your Studies <span className="text-brand-primary block mt-2">Faster with AI.</span>
              </h1>
              
              <p className="text-xl md:text-2xl text-brand-muted mb-12 max-w-3xl mx-auto leading-relaxed">
                 Trusted by top-tier students. Instantly transform any lecture, document, or YouTube video into interactive flashcards, true/false tests, and intelligent quizzes.
              </p>
           </motion.div>

           {/* MOCK INTERACTIVE WIDGET (Redirects to Generator) */}
           <motion.div 
             initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
             onClick={() => navigate('/generate')}
             className="max-w-3xl mx-auto glass-panel p-2 rounded-3xl border border-brand-border shadow-[0_0_50px_rgba(139,92,246,0.1)] group cursor-pointer hover:border-brand-primary/50 transition-all relative"
           >
              <div className="absolute inset-0 bg-brand-primary/0 group-hover:bg-brand-primary/5 rounded-3xl transition-colors"></div>
              
              <div className="p-8 md:p-12 border-2 border-dashed border-brand-border rounded-[1.5rem] bg-brand-surface/50 group-hover:border-brand-primary/40 transition-colors flex flex-col items-center justify-center">
                 <div className="flex gap-4 mb-6">
                    <div className="w-14 h-14 bg-brand-primary/20 rounded-2xl flex items-center justify-center text-brand-primary shadow-lg"><FileText className="w-7 h-7" /></div>
                    <div className="w-14 h-14 bg-red-500/20 rounded-2xl flex items-center justify-center text-red-500 shadow-lg"><PlayCircle className="w-7 h-7" /></div>
                    <div className="w-14 h-14 bg-blue-500/20 rounded-2xl flex items-center justify-center text-blue-500 shadow-lg"><LinkIcon className="w-7 h-7" /></div>
                 </div>
                 <h3 className="text-2xl font-bold mb-2 group-hover:text-brand-primary transition-colors">Generate Your Next 'A+'</h3>
                 <p className="text-brand-muted font-medium mb-6">Drop your PDF, paste text, or insert a link here.</p>
                 <button className="px-8 py-4 bg-brand-text text-brand-bg rounded-xl font-bold text-lg flex items-center gap-3 transition-transform group-hover:scale-105 group-hover:bg-brand-primary group-hover:text-white">
                    Start Generating <ArrowRight className="w-5 h-5"/>
                 </button>
              </div>
           </motion.div>
        </div>
      </section>

      {/* CORE FEATURES */}
      <section className="py-24 px-6 border-y border-brand-border bg-brand-surface/30">
         <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
               <h2 className="text-4xl font-bold mb-4">Study Smarter, Not Harder</h2>
               <p className="text-xl text-brand-muted">Stop wasting hours crafting notes. Start actually learning them.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
               {features.map((f, i) => (
                  <motion.div 
                     initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                     key={i} className="glass-panel p-8 rounded-[2rem] border border-brand-border hover:border-brand-primary/30 transition-all hover:-translate-y-2"
                  >
                     <div className="w-16 h-16 bg-brand-bg rounded-2xl flex items-center justify-center mb-6 shadow-md border border-brand-border">
                        {f.icon}
                     </div>
                     <h3 className="text-2xl font-bold mb-3">{f.title}</h3>
                     <p className="text-brand-muted leading-relaxed text-lg">{f.description}</p>
                  </motion.div>
               ))}
            </div>
         </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-24 px-6 relative overflow-hidden">
         <div className="absolute right-0 top-1/2 -translate-y-1/2 w-96 h-96 bg-brand-primary/10 rounded-full blur-[100px] pointer-events-none"></div>
         <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16">
            <div className="lg:w-1/2 relative z-10">
               <h2 className="text-4xl font-bold mb-6">From raw file to active recall in seconds.</h2>
               <p className="text-xl text-brand-muted mb-10 leading-relaxed">Our engine handles the tedious processing. You just focus on retrieving the answers using our heavily optimized interface.</p>
               
               <div className="space-y-8">
                  {steps.map((step, i) => (
                     <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }} key={i} className="flex gap-6">
                        <div className="flex flex-col items-center">
                           <div className="w-12 h-12 bg-brand-primary/20 text-brand-primary rounded-full flex items-center justify-center font-black text-lg border border-brand-primary/30 shrink-0">
                              {step.num}
                           </div>
                           {i !== 2 && <div className="w-0.5 h-12 bg-brand-border mt-2"></div>}
                        </div>
                        <div>
                           <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                           <p className="text-brand-muted text-lg">{step.text}</p>
                        </div>
                     </motion.div>
                  ))}
               </div>
            </div>
            
            <div className="lg:w-1/2 w-full">
               <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
                  className="glass-panel p-2 rounded-[2rem] border border-brand-border shadow-2xl relative"
               >
                  <div className="absolute -inset-1 bg-gradient-to-r from-brand-primary to-blue-500 rounded-[2rem] blur opacity-20"></div>
                  <div className="bg-brand-bg rounded-[1.8rem] border border-brand-border p-6 relative overflow-hidden h-[400px] flex flex-col">
                     {/* Decorative UI inside */}
                     <div className="flex gap-3 mb-6">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                     </div>
                     <div className="flex-1 border-t border-brand-border pt-6 space-y-4">
                        <div className="flex items-center gap-4 p-4 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-100">
                           <CheckCircle2 className="text-blue-500" /> Multiple Choice Matrix Extracted
                        </div>
                        <div className="flex items-center gap-4 p-4 rounded-xl border border-green-500/30 bg-green-500/10 text-green-100">
                           <CheckCircle2 className="text-green-500" /> True / False Analysis Complete
                        </div>
                        <div className="flex items-center gap-4 p-4 rounded-xl border border-brand-primary/30 bg-brand-primary/10 text-brand-primary">
                           <CheckCircle2 className="text-brand-primary" /> Spaced Repetition Activated
                        </div>
                     </div>
                  </div>
               </motion.div>
            </div>
         </div>
      </section>

      {/* FAQ SECTION */}
      <section className="py-24 px-6 border-t border-brand-border bg-brand-surface/50">
         <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
               <h2 className="text-4xl font-bold mb-4">Frequently Asked Questions</h2>
            </div>
            
            <div className="space-y-4">
               {faqs.map((faq, i) => (
                  <motion.div 
                     initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                     key={i} className="glass-panel border border-brand-border rounded-2xl overflow-hidden"
                  >
                     <button 
                        onClick={() => setOpenFaq(openFaq === i ? null : i)}
                        className="w-full px-6 py-6 text-left flex justify-between items-center hover:bg-white/5 transition-colors"
                     >
                        <span className="font-bold text-lg">{faq.q}</span>
                        <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${openFaq === i ? 'rotate-180 text-brand-primary' : 'text-brand-muted'}`} />
                     </button>
                     <AnimatePresence>
                        {openFaq === i && (
                           <motion.div 
                              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                              className="px-6 pb-6 text-brand-muted text-lg leading-relaxed"
                           >
                              {faq.a}
                           </motion.div>
                        )}
                     </AnimatePresence>
                  </motion.div>
               ))}
            </div>
         </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="py-32 px-6 relative text-center">
         <div className="absolute inset-0 bg-gradient-to-t from-brand-primary/10 to-transparent pointer-events-none"></div>
         <div className="max-w-4xl mx-auto relative z-10 glass-panel p-16 rounded-[3rem] border border-brand-border shadow-[0_0_50px_rgba(139,92,246,0.15)]">
            <h2 className="text-5xl font-bold mb-6">Stop memorizing. <br/>Start mastering.</h2>
            <p className="text-xl text-brand-muted mb-10">Join thousands of proactive learners breaking the curve today.</p>
            <button onClick={() => navigate('/generate')} className="px-10 py-5 bg-brand-primary text-white rounded-2xl font-bold text-xl hover:scale-105 transition-all shadow-xl shadow-brand-primary/30 flex items-center gap-3 mx-auto">
               Try LearnAID For Free <ArrowRight className="w-6 h-6" />
            </button>
         </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-brand-border py-12 px-6 bg-[#0a0a0a]">
         <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
               <BrainCircuit className="w-6 h-6 text-brand-primary" />
               <span className="font-bold text-lg">LearnAID</span>
            </div>
            <p className="text-brand-muted text-sm border border-brand-border px-4 py-2 rounded-full">
               System Architecture &copy; 2026. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-brand-muted">
               <a href="#" className="hover:text-brand-primary transition-colors">Privacy Policy</a>
               <a href="#" className="hover:text-brand-primary transition-colors">Terms of Service</a>
            </div>
         </div>
      </footer>

    </div>
  );
}

// Quick component for the Layers icon if not imported standard from lucide
function Layers(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
      <polyline points="2 12 12 17 22 12"></polyline>
      <polyline points="2 17 12 22 22 17"></polyline>
    </svg>
  );
}
