import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { BrainCircuit, Loader2, Play, Plus, BookOpen, Download, Database, CheckCircle2, TrendingUp, Compass, Target, Hash, CheckSquare, Layers, Clock, ArrowRight, Trash2, Edit2, UserCircle, Mail, LogOut, X } from 'lucide-react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Legend, Cell } from 'recharts';

export default function Dashboard() {
  const { user, fetchUser, logout } = useAuth();
  const navigate = useNavigate();
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [renameModal, setRenameModal] = useState({ open: false, id: null, title: '' });

  // Poll for latest stats on load
  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    const bootstrap = async () => {
       await fetchUser();
       await fetchSets();
    };
    bootstrap();
  }, [user?.email]); // don't infinitely re-render

  const fetchSets = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:8000/api/flashcard-sets');
      setSets(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };
  
  const handleDeleteSet = async (id) => {
     try {
        await axios.delete(`http://127.0.0.1:8000/api/flashcard-sets/${id}`);
        setDeleteConfirmId(null);
        await fetchSets();
        if(fetchUser) fetchUser();
     } catch (e) {
        console.error(e);
     }
  };

  const handleRenameSet = async () => {
     if (!renameModal.title.trim()) return;
     try {
        await axios.put(`http://127.0.0.1:8000/api/flashcard-sets/${renameModal.id}/title`, { title: renameModal.title });
        setRenameModal({ open: false, id: null, title: '' });
        await fetchSets();
     } catch (e) {
        console.error(e);
     }
  };
  
  const handleContinue = async (set) => {
    try {
       await axios.put(`http://127.0.0.1:8000/api/flashcard-sets/${set.id}/access`);
    } catch(e) {}
    navigate(`/study/${set.id}`);
  }

  const exportToCSV = (set) => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Question,Answer\n" 
      + set.flashcards.map(card => {
          const q = card.question.replace(/"/g, '""');
          const a = card.answer.replace(/"/g, '""');
          return `"${q}","${a}"`;
      }).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${set.title.replace(/\s+/g, '_')}_flashcards.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Structured Data Architecture (as requested)
  const dashboardData = useMemo(() => {
    let totalCards = 0;
    let masteredCards = 0;
    let mostRecentParsed = null;

    const mappedSets = sets.map(set => {
      const mastered = set.flashcards.filter(c => c.mastery_level === 3).length;
      totalCards += set.flashcards.length;
      masteredCards += mastered;
      
      const setPercent = set.flashcards.length > 0 ? Math.round((mastered / set.flashcards.length) * 100) : 0;
      
      // Calculate "type" based on payload
      let typeLabel = "Mixed Context";
      if (set.quiz.length === 0 && set.fill_blanks.length === 0) typeLabel = "Flashcards Only";
      else if (set.flashcards.length === 0) typeLabel = "Assessments";
      
      let lastTime = new Date(set.last_accessed || set.created_at).getTime();
      return {
         ...set,
         progressPercent: setPercent,
         typeLabel: typeLabel,
         unixTime: lastTime
      }
    }).sort((a,b) => b.unixTime - a.unixTime); // Sort by most recent

    if (mappedSets.length > 0) {
      mostRecentParsed = mappedSets[0];
    }
    
    // Overall Mastery based on DB state + frontend map
    const calculatedMastery = totalCards > 0 ? Math.round((masteredCards / totalCards) * 100) : 0;

    return {
       user: { name: user?.name || user?.email?.split('@')[0] || "User" },
       stats: {
          totalSets: sets.length,
          totalCards: user?.stats?.total_flashcards_studied || 0,
          mastery: calculatedMastery,
          quizAttempts: user?.stats?.quiz_attempts || 0,
          quizAccuracy: user?.stats?.quizAccuracy || 0
       },
       studySets: mappedSets,
       recentSet: mostRecentParsed, // Continue Learning Hook
       activity: [
         { name: 'Mon', sessions: 2 },
         { name: 'Tue', sessions: 5 },
         { name: 'Wed', sessions: 3 },
         { name: 'Thu', sessions: 8 },
         { name: 'Fri', sessions: 4 },
         { name: 'Sat', sessions: 6 },
         { name: 'Sun', sessions: 5 },
       ], // Dummy mapping for visual tracking requirements
       performance: {
         quiz: user?.stats?.quizAccuracy || 0,
         trueFalse: user?.stats?.trueFalseAccuracy || 0,
         fillBlank: user?.stats?.fillBlankAccuracy || 0
       }
    };
  }, [sets, user]);

  const filteredSets = dashboardData.studySets;

  const perfChartData = [
    { name: 'Multiple Choice', score: dashboardData.performance.quiz },
    { name: 'True / False', score: dashboardData.performance.trueFalse },
    { name: 'Fill in Blank', score: dashboardData.performance.fillBlank },
  ];

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-brand-bg">
      <Loader2 className="w-12 h-12 animate-spin text-brand-primary mb-4" />
      <p className="text-brand-muted font-medium animate-pulse">Initializing Command Center...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text relative pb-32">
      {/* 1. HEADER / NAVBAR */}
      <header className="sticky top-0 z-50 bg-brand-surface/80 backdrop-blur-md border-b border-brand-border">
         <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="p-2.5 bg-brand-primary/20 rounded-xl shadow-[0_0_15px_rgba(139,92,246,0.3)]">
                 <BrainCircuit className="w-6 h-6 text-brand-primary" />
               </div>
               <h1 className="text-2xl font-bold tracking-tight">Learn<span className="text-brand-primary">AID</span></h1>
            </div>
            
            <div className="flex items-center gap-6 relative">
               <div 
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="hidden md:flex items-center gap-3 cursor-pointer hover:bg-brand-surface p-2 rounded-xl transition-colors border border-transparent hover:border-brand-border"
               >
                  <div className="w-10 h-10 rounded-full bg-brand-primary/20 flex items-center justify-center text-brand-primary font-bold border border-brand-primary/30">
                     {dashboardData.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                     <span className="text-sm font-bold">{dashboardData.user.name}</span>
                     <span className="text-xs text-brand-muted">Pro Member</span>
                  </div>
               </div>
               
               {/* Clickable Profile Modal Overlay */}
               {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)}></div>
                    <motion.div 
                       initial={{ opacity: 0, y: 10, scale: 0.95 }}
                       animate={{ opacity: 1, y: 0, scale: 1 }}
                       className="absolute top-16 right-0 w-72 glass-panel p-6 rounded-3xl border border-brand-border shadow-2xl z-50 flex flex-col gap-4"
                    >
                       <div className="flex items-center gap-4 border-b border-brand-border pb-4">
                          <div className="w-14 h-14 rounded-full bg-brand-primary flex items-center justify-center text-white font-bold text-xl shadow-lg">
                             {dashboardData.user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                             <h4 className="font-bold text-lg">{dashboardData.user.name}</h4>
                             <p className="text-sm text-brand-muted truncate max-w-[150px]">{user?.email}</p>
                          </div>
                       </div>
                       
                       <div className="flex flex-col gap-2">
                          <div className="flex justify-between items-center text-sm p-2 rounded-lg bg-brand-bg border border-brand-border">
                             <span className="text-brand-muted flex items-center gap-2"><UserCircle className="w-4 h-4"/> Status</span>
                             <span className="font-bold text-brand-primary">Active</span>
                          </div>
                          <div className="flex justify-between items-center text-sm p-2 rounded-lg bg-brand-bg border border-brand-border">
                             <span className="text-brand-muted flex items-center gap-2"><Mail className="w-4 h-4"/> Email</span>
                             <span className="font-bold truncate max-w-[100px]">{user?.email}</span>
                          </div>
                       </div>
                       
                       <button onClick={handleLogout} className="mt-2 w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl font-bold transition-colors flex justify-center items-center gap-2">
                          <LogOut className="w-4 h-4" /> Sign Out
                       </button>
                    </motion.div>
                  </>
               )}
            </div>
         </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 pt-10">
         
         <div className="flex justify-between items-end mb-8">
            <div>
               <h2 className="text-4xl font-bold mb-2">Welcome back, {dashboardData.user.name}</h2>
               <p className="text-brand-muted text-lg">Here is an overview of your active learning progress.</p>
            </div>
         </div>

         {/* 2. LEARNING OVERVIEW (TOP CARDS) */}
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <motion.div whileHover={{ y: -4 }} className="glass-panel p-6 rounded-3xl border border-brand-border flex items-center gap-4">
               <div className="w-14 h-14 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-500 shrink-0"><Database className="w-7 h-7"/></div>
               <div>
                  <p className="text-brand-muted font-medium mb-1">Total Sets</p>
                  <h3 className="text-3xl font-bold">{dashboardData.stats.totalSets}</h3>
               </div>
            </motion.div>
            <motion.div whileHover={{ y: -4 }} className="glass-panel p-6 rounded-3xl border border-brand-border flex items-center gap-4">
               <div className="w-14 h-14 rounded-2xl bg-purple-500/20 flex items-center justify-center text-brand-primary shrink-0"><Layers className="w-7 h-7"/></div>
               <div>
                  <p className="text-brand-muted font-medium mb-1">Cards Studied</p>
                  <h3 className="text-3xl font-bold">{dashboardData.stats.totalCards}</h3>
               </div>
            </motion.div>
            <motion.div whileHover={{ y: -4 }} className="glass-panel p-6 rounded-3xl border border-brand-border flex items-center gap-4 relative overflow-hidden">
               <div className="w-14 h-14 rounded-2xl bg-green-500/20 flex items-center justify-center text-green-500 shrink-0"><Target className="w-7 h-7"/></div>
               <div className="z-10">
                  <p className="text-brand-muted font-medium mb-1">Overall Mastery</p>
                  <h3 className="text-3xl font-bold text-green-400">{dashboardData.stats.mastery}%</h3>
               </div>
               <div className="absolute bottom-0 left-0 h-1 bg-green-500/30 w-full"><div className="h-full bg-green-500" style={{ width: `${dashboardData.stats.mastery}%` }}></div></div>
            </motion.div>
            <motion.div whileHover={{ y: -4 }} className="glass-panel p-6 rounded-3xl border border-brand-border flex items-center gap-4 relative overflow-hidden">
               <div className="w-14 h-14 rounded-2xl bg-orange-500/20 flex items-center justify-center text-orange-500 shrink-0"><CheckSquare className="w-7 h-7"/></div>
               <div className="z-10">
                  <p className="text-brand-muted font-medium mb-1">Quiz Accuracy</p>
                  <h3 className="text-3xl font-bold text-orange-400">{dashboardData.stats.quizAccuracy}%</h3>
               </div>
               <div className="absolute bottom-0 left-0 h-1 bg-orange-500/30 w-full"><div className="h-full bg-orange-500" style={{ width: `${dashboardData.stats.quizAccuracy}%` }}></div></div>
            </motion.div>
         </div>

         {/* 3. CONTINUE LEARNING (CRITICAL FEATURE) */}
         <div className="mb-14">
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-3"><Compass className="w-6 h-6 text-brand-primary"/> Jump Back In</h3>
            {dashboardData.recentSet ? (
               <div className="glass-panel p-8 rounded-[2rem] border border-brand-border bg-gradient-to-br from-brand-surface to-brand-primary/5 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group">
                  <div className="absolute -right-20 -top-20 w-64 h-64 bg-brand-primary/10 rounded-full blur-3xl group-hover:bg-brand-primary/20 transition-all"></div>
                  
                  <div className="flex-1 z-10 w-full">
                     <div className="flex items-center gap-3 mb-3">
                        <span className="px-3 py-1 bg-brand-bg rounded-lg text-xs font-bold text-brand-muted border border-brand-border uppercase tracking-wide">Last Accessed: {new Date(dashboardData.recentSet.unixTime).toLocaleDateString()}</span>
                        <span className="px-3 py-1 bg-brand-primary/20 rounded-lg text-xs font-bold text-brand-primary border border-brand-primary/30">{dashboardData.recentSet.typeLabel}</span>
                     </div>
                     <h2 className="text-3xl md:text-4xl font-bold mb-4">{dashboardData.recentSet.title}</h2>
                     
                     <div className="flex items-center gap-4 max-w-sm">
                        <div className="flex-1 h-3 bg-brand-bg rounded-full overflow-hidden border border-brand-border/50">
                           <div className="h-full bg-gradient-to-r from-brand-primary to-blue-500 rounded-full" style={{ width: `${dashboardData.recentSet.progressPercent}%` }}></div>
                        </div>
                        <span className="font-bold text-brand-text">{dashboardData.recentSet.progressPercent}%</span>
                     </div>
                  </div>

                  <div className="z-10 w-full md:w-auto">
                     <button 
                        onClick={() => handleContinue(dashboardData.recentSet)}
                        className="w-full md:w-auto px-10 py-5 bg-brand-text text-brand-bg hover:bg-brand-primary hover:text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-xl hover:scale-105"
                     >
                        Continue Learning <ArrowRight className="w-6 h-6" />
                     </button>
                  </div>
               </div>
            ) : (
               <div className="glass-panel p-10 rounded-3xl border border-dashed border-brand-border text-center flex flex-col items-center">
                  <div className="w-20 h-20 bg-brand-primary/10 rounded-full flex items-center justify-center mb-6">
                     <BookOpen className="w-10 h-10 text-brand-primary" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">No active study sessions</h3>
                  <p className="text-brand-muted mb-8 text-lg">Start building your knowledge tree gracefully.</p>
                  <button onClick={() => navigate('/generate')} className="px-8 py-4 bg-brand-primary text-white rounded-xl font-bold hover:scale-105 transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)]">Create New Study Set</button>
               </div>
            )}
         </div>

         {/* GRID: PROGRESS ANALYTICS & PERFORMANCE BREAKDOWN */}
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-14">
            
            {/* 4. PROGRESS ANALYTICS */}
            <div className="glass-panel p-6 rounded-[2rem] border border-brand-border flex flex-col">
               <h3 className="text-xl font-bold mb-6 flex items-center gap-3"><TrendingUp className="w-5 h-5 text-green-400"/> Activity Tracker</h3>
               <div className="w-full h-[300px] flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                     <LineChart data={dashboardData.activity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                        <XAxis dataKey="name" stroke="#ffffff50" axisLine={false} tickLine={false} dy={10} />
                        <YAxis stroke="#ffffff50" axisLine={false} tickLine={false} />
                        <RechartsTooltip 
                           contentStyle={{ backgroundColor: '#0f172a', borderColor: '#ffffff20', borderRadius: '1rem', color: '#fff' }}
                           itemStyle={{ color: '#8b5cf6' }}
                        />
                        <Line type="monotone" dataKey="sessions" stroke="#8b5cf6" strokeWidth={4} dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }} activeDot={{ r: 8 }} />
                     </LineChart>
                  </ResponsiveContainer>
               </div>
            </div>

            {/* 5. PERFORMANCE BREAKDOWN */}
            <div className="glass-panel p-6 rounded-[2rem] border border-brand-border flex flex-col">
               <h3 className="text-xl font-bold mb-6 flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-orange-400"/> Structural Accuracies</h3>
               <div className="w-full h-[300px] flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={perfChartData} layout="vertical" margin={{ top: 0, right: 30, left: 30, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} stroke="#ffffff50" axisLine={false} tickLine={false} />
                        <YAxis dataKey="name" type="category" stroke="#fff" axisLine={false} tickLine={false} width={120} fontWeight={600} />
                        <RechartsTooltip 
                           cursor={{fill: '#ffffff05'}}
                           contentStyle={{ backgroundColor: '#0f172a', borderColor: '#ffffff20', borderRadius: '1rem', color: '#fff' }}
                           formatter={(value) => [`${value}%`, 'Accuracy']}
                        />
                        <Bar dataKey="score" radius={[0, 8, 8, 0]} barSize={20}>
                           {perfChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.score > 80 ? '#22c55e' : entry.score > 50 ? '#f59e0b' : '#ef4444'} />
                           ))}
                        </Bar>
                     </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>
         </div>


         {/* 6. YOUR STUDY MATERIAL */}
         <div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
               <h3 className="text-2xl font-bold flex items-center gap-3"><BookOpen className="w-6 h-6 text-brand-primary"/> Your Study Material</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {filteredSets.map(set => (
                  <motion.div 
                     layout
                     initial={{ opacity: 0, scale: 0.9 }}
                     animate={{ opacity: 1, scale: 1 }}
                     whileHover={{ y: -5 }}
                     key={set.id} 
                     className="glass-panel p-6 rounded-2xl border border-brand-border flex flex-col h-full hover:shadow-[0_10px_30px_rgba(139,92,246,0.1)] transition-all relative group"
                  >
                     <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                        {deleteConfirmId === set.id ? (
                           <div className="flex items-center gap-2 bg-brand-surface p-1 rounded-lg border border-red-500/50 shadow-lg pr-3">
                              <button onClick={() => setDeleteConfirmId(null)} className="p-1 text-brand-muted hover:text-white"><X className="w-4 h-4"/></button>
                              <span className="text-xs font-bold text-red-500">Delete?</span>
                              <button onClick={() => handleDeleteSet(set.id)} className="p-1 flex items-center justify-center bg-red-500 text-white rounded-md"><CheckCircle2 className="w-4 h-4"/></button>
                           </div>
                        ) : (
                           <>
                              <button onClick={() => setRenameModal({ open: true, id: set.id, title: set.title })} className="p-2 bg-brand-bg rounded-lg text-brand-muted hover:text-brand-primary transition-colors border border-brand-border shadow-md" title="Rename Set">
                                 <Edit2 className="w-4 h-4"/>
                              </button>
                              <button onClick={() => exportToCSV(set)} className="p-2 bg-brand-bg rounded-lg text-brand-muted hover:text-brand-primary transition-colors border border-brand-border shadow-md" title="Export CSV">
                                 <Download className="w-4 h-4"/>
                              </button>
                              <button onClick={() => setDeleteConfirmId(set.id)} className="p-2 bg-brand-bg rounded-lg text-brand-muted hover:text-red-500 transition-colors border border-brand-border shadow-md" title="Delete Set">
                                 <Trash2 className="w-4 h-4"/>
                              </button>
                           </>
                        )}
                     </div>

                     <div className="flex items-center gap-2 mb-3">
                        <span className="px-2.5 py-1 bg-brand-surface rounded-md border border-brand-border text-xs font-bold text-brand-muted"><Clock className="w-3 h-3 inline mr-1"/> {new Date(set.unixTime).toLocaleDateString()}</span>
                        <span className="px-2.5 py-1 bg-brand-primary/10 rounded-md border border-brand-primary/30 text-xs font-bold text-brand-primary">{set.typeLabel}</span>
                     </div>

                     <h3 className="text-xl font-bold mb-4 line-clamp-2 text-brand-text pr-8">{set.title}</h3>
                     
                     <div className="flex justify-between text-sm mb-2 text-brand-muted font-medium mt-auto">
                        <span>Mastery Progress</span>
                        <span className={set.progressPercent === 100 ? 'text-green-500' : ''}>{set.progressPercent}%</span>
                     </div>
                     <div className="w-full h-1.5 bg-brand-bg rounded-full overflow-hidden mb-6 border border-brand-border">
                       <div className="h-full bg-brand-primary" style={{ width: `${set.progressPercent}%` }}></div>
                     </div>

                     <div className="flex gap-3 mt-auto">
                       <button onClick={() => handleContinue(set)} className="flex-1 py-3 bg-brand-surface hover:bg-brand-primary/10 text-brand-text border border-brand-border rounded-xl transition-all flex items-center justify-center gap-2 font-medium">
                         Review
                       </button>
                       <button onClick={() => handleContinue(set)} className="flex-1 py-3 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl transition-all flex items-center justify-center gap-2 font-medium shadow-md">
                         <Play className="w-4 h-4" /> Continue
                       </button>
                     </div>
                  </motion.div>
               ))}
            </div>
         </div>

      </div>

      {/* 7. QUICK ACTIONS (FLOATING HIGH UX PRIORITY) */}
      <div className="fixed bottom-10 right-10 z-50">
         <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/generate')}
            className="w-16 h-16 bg-brand-primary text-white rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(139,92,246,0.6)] cursor-pointer"
         >
            <Plus className="w-8 h-8" />
         </motion.button>
      </div>

      {/* RENAME MODAL */}
      {renameModal.open && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-panel p-8 rounded-3xl border border-brand-border shadow-2xl max-w-md w-full relative">
               <button onClick={() => setRenameModal({ open: false, id: null, title: '' })} className="absolute top-6 right-6 text-brand-muted hover:text-white"><X className="w-5 h-5"/></button>
               <h3 className="text-2xl font-bold mb-6">Rename Study Set</h3>
               <input 
                  type="text" 
                  value={renameModal.title} 
                  onChange={(e) => setRenameModal(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-brand-bg border border-brand-border rounded-xl p-4 text-brand-text outline-none focus:border-brand-primary mb-6"
                  placeholder="Enter new title..."
               />
               <button onClick={handleRenameSet} className="w-full py-4 bg-brand-primary text-white font-bold rounded-xl hover:scale-105 transition-transform shadow-lg">Save Changes</button>
            </motion.div>
         </div>
      )}

    </div>
  );
}
