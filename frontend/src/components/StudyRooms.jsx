import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, UserPlus, FileText, Award, LogOut, Copy, Check, ChevronRight, BookOpen, Send, Loader2 } from 'lucide-react';
import api, { getErrorMessage } from '../lib/api';

export default function StudyRooms() {
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [personalDecks, setPersonalDecks] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [roomLoading, setRoomLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  const [roomCode, setRoomCode] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [selectedDeckId, setSelectedDeckId] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch user's joined rooms
  const fetchRooms = async (selectRoomId = null) => {
    try {
      setLoading(true);
      const res = await api.get('/api/study-rooms/');
      setRooms(res.data || []);
      
      // Auto-select room if requested
      if (selectRoomId) {
        await selectRoom(selectRoomId);
      } else if (res.data.length > 0 && !activeRoom) {
        await selectRoom(res.data[0].id);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load study groups.'));
    } finally {
      setLoading(false);
    }
  };

  // Select active room and fetch its details + leaderboard
  const selectRoom = async (roomId) => {
    try {
      setRoomLoading(true);
      setError('');
      setSuccess('');
      
      // Fetch Room Details
      const roomDetailsRes = await api.get(`/api/study-rooms/${roomId}`);
      setActiveRoom(roomDetailsRes.data);
      
      // Fetch Leaderboard
      const leaderboardRes = await api.get(`/api/study-rooms/${roomId}/leaderboard`);
      setLeaderboard(leaderboardRes.data || []);
      
      // Fetch personal decks to facilitate sharing
      const personalDecksRes = await api.get('/api/flashcard-sets/');
      
      // Filter out decks that are already associated with this room
      const sharedDeckIds = new Set(roomDetailsRes.data.decks.map(d => d.id));
      const shareable = (personalDecksRes.data || []).filter(d => !sharedDeckIds.has(d.id));
      setPersonalDecks(shareable);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to fetch study room details.'));
    } finally {
      setRoomLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  // Handle creating a new study room
  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    try {
      setActionLoading(true);
      setError('');
      const res = await api.post('/api/study-rooms/', { name: newRoomName });
      setNewRoomName('');
      setSuccess(`Created study room "${res.data.name}"!`);
      setShowCreateModal(false);
      await fetchRooms(res.data.id);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create room.'));
    } finally {
      setActionLoading(false);
    }
  };

  // Handle joining a study room via code
  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (!roomCode.trim()) return;
    try {
      setActionLoading(true);
      setError('');
      const res = await api.post('/api/study-rooms/join', { code: roomCode });
      setRoomCode('');
      setSuccess(res.data.message || 'Successfully joined the study group!');
      setShowJoinModal(false);
      await fetchRooms(res.data.room_id);
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid room code or unable to join.'));
    } finally {
      setActionLoading(false);
    }
  };

  // Handle sharing a deck with the study room
  const handleShareDeck = async (e) => {
    e.preventDefault();
    if (!selectedDeckId || !activeRoom) return;
    try {
      setActionLoading(true);
      setError('');
      await api.post(`/api/study-rooms/${activeRoom.id}/decks`, { set_id: parseInt(selectedDeckId) });
      setSuccess('Deck shared with the group successfully!');
      setSelectedDeckId('');
      await selectRoom(activeRoom.id);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to share study deck.'));
    } finally {
      setActionLoading(false);
    }
  };

  // Leave study room
  const handleLeaveRoom = async () => {
    if (!activeRoom) return;
    const confirmMsg = activeRoom.creator_id === activeRoom.members.find(m => m.email)?.id 
      ? 'Warning: As the creator, leaving this room will permanently delete it for all members. Proceed?'
      : 'Are you sure you want to leave this study group?';
      
    if (!window.confirm(confirmMsg)) return;

    try {
      setActionLoading(true);
      setError('');
      await api.delete(`/api/study-rooms/${activeRoom.id}/leave`);
      setActiveRoom(null);
      setSuccess('Left the study group.');
      await fetchRooms();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to leave the room.'));
    } finally {
      setActionLoading(false);
    }
  };

  // Fallback Copy function for non-secure contexts (HTTP)
  const fallbackCopyText = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.error('Fallback copy failed:', err);
    }
    document.body.removeChild(textArea);
  };

  // Copy Room Code to clipboard
  const copyToClipboard = () => {
    if (!activeRoom) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(activeRoom.code)
        .then(() => {
          setCopiedCode(true);
          setTimeout(() => setCopiedCode(false), 2000);
        })
        .catch(err => {
          console.warn('Clipboard API failed, using fallback copy:', err);
          fallbackCopyText(activeRoom.code);
        });
    } else {
      fallbackCopyText(activeRoom.code);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Alert/Status Toast */}
      <AnimatePresence>
        {(error || success) && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`mb-6 p-4 rounded-xl text-xs font-semibold flex items-center justify-between shadow-sm border ${
              error 
                ? 'bg-red-500/10 border-red-500/20 text-red-500' 
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
            }`}
          >
            <span>{error || success}</span>
            <button onClick={() => { setError(''); setSuccess(''); }} className="hover:scale-110 ml-2">✖</button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left Column: Room list and management */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="bg-brand-card/30 backdrop-blur-md border border-brand-muted/10 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-brand-text flex items-center gap-2">
                <Users className="w-5 h-5 text-brand-primary" /> Study Groups
              </h3>
              
              {/* Quick action buttons in sidebar header */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowJoinModal(true)}
                  className="p-1.5 hover:bg-brand-primary/15 text-brand-muted hover:text-brand-primary rounded-lg transition-all cursor-pointer border border-brand-border/40 hover:border-brand-primary/20"
                  title="Join Group via Code"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="p-1.5 hover:bg-emerald-500/15 text-brand-muted hover:text-emerald-500 rounded-lg transition-all cursor-pointer border border-brand-border/40 hover:border-emerald-500/20"
                  title="Create New Group"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            
            {/* Joined Rooms List */}
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
              </div>
            ) : rooms.length === 0 ? (
              <p className="text-brand-muted text-xs text-center py-6">You have not joined any study rooms yet.</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto no-scrollbar">
                {rooms.map(room => (
                  <button
                    key={room.id}
                    onClick={() => selectRoom(room.id)}
                    className={`w-full text-left p-3 rounded-xl flex items-center justify-between transition-all duration-200 ${
                      activeRoom?.id === room.id
                        ? 'bg-brand-primary/10 border border-brand-primary/20 text-brand-text'
                        : 'bg-brand-muted/5 border border-transparent hover:bg-brand-muted/10 text-brand-muted hover:text-brand-text'
                    }`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold truncate max-w-[140px]">{room.name}</span>
                      <span className="text-[10px] opacity-75">{room.decks_count} decks • {room.members_count} members</span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-75" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Active study room details (Redesigned Split Layout) */}
        <div className="lg:col-span-3">
          {roomLoading ? (
            <div className="bg-brand-card/30 backdrop-blur-md border border-brand-muted/10 rounded-3xl p-8 flex flex-col items-center justify-center min-h-[400px]">
              <Loader2 className="w-8 h-8 animate-spin text-brand-primary mb-2" />
              <p className="text-brand-muted text-xs animate-pulse">Fetching study group details...</p>
            </div>
          ) : !activeRoom ? (
            /* Welcome state when no room is active */
            <div className="bg-brand-card/30 backdrop-blur-md border border-brand-muted/10 rounded-3xl p-8 flex flex-col items-center justify-center text-center min-h-[400px] shadow-sm">
              <div className="w-16 h-16 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary mb-6">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-brand-text mb-2">Welcome to Study Groups!</h3>
              <p className="text-brand-muted text-xs max-w-md mb-6">
                Collaborate with classmates on university courses. Generate unified study decks, share revision notes, and climb the weekly leaderboard for mock exam accuracy.
              </p>
              
              {/* Operational Action Buttons under welcome message */}
              <div className="flex flex-col sm:flex-row gap-3 text-xs font-medium">
                <button 
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center justify-center gap-1.5 bg-brand-primary hover:bg-brand-primary/90 text-white px-5 py-3 rounded-2xl transition-all cursor-pointer font-bold shadow-md hover:scale-102 active:scale-95 min-h-[44px]"
                >
                  <Plus className="w-4 h-4" /> Create a Group
                </button>
                <button 
                  onClick={() => setShowJoinModal(true)}
                  className="flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-3 rounded-2xl transition-all cursor-pointer font-bold shadow-md hover:scale-102 active:scale-95 min-h-[44px]"
                >
                  <UserPlus className="w-4 h-4" /> Join via Code
                </button>
              </div>
            </div>
          ) : (
            /* Redesigned Active Study Room (Simplified tabless split view) */
            <div className="flex flex-col gap-6">
              
              {/* Room Header Info */}
              <div className="bg-brand-card/30 backdrop-blur-md border border-brand-muted/10 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex flex-col gap-1.5">
                  <h2 className="text-lg font-bold text-brand-text flex items-center gap-2">
                    <span className="bg-brand-primary/15 text-brand-primary text-[10px] font-black uppercase px-2 py-0.5 rounded-md">CLASSROOM</span>
                    {activeRoom.name}
                  </h2>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-brand-muted">Invite Code:</span>
                    <button 
                      onClick={copyToClipboard}
                      className="bg-brand-muted/5 hover:bg-brand-primary/10 border border-brand-muted/10 hover:border-brand-primary/20 font-mono font-bold text-brand-primary px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all"
                    >
                      {activeRoom.code}
                      {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-4">
                  <button 
                    onClick={handleLeaveRoom}
                    className="flex items-center gap-1 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ml-auto md:ml-0 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Leave Room
                  </button>
                </div>
              </div>

              {/* Redesigned Split Grid Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Side: Shared Decks & Summaries (2/3 width) */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                  
                  {/* Shared Decks List Card */}
                  <div className="bg-brand-card/30 backdrop-blur-md border border-brand-muted/10 rounded-3xl p-6 shadow-sm">
                    <h3 className="text-sm font-bold text-brand-text mb-4 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-brand-primary" /> Shared Study Decks ({activeRoom.decks.length})
                    </h3>
                    
                    {activeRoom.decks.length === 0 ? (
                      <div className="bg-brand-muted/5 border border-dashed border-brand-border rounded-2xl p-8 text-center flex flex-col items-center justify-center">
                        <FileText className="w-10 h-10 text-brand-muted mb-2 opacity-50" />
                        <h4 className="text-xs font-bold text-brand-text mb-1">No shared decks yet</h4>
                        <p className="text-brand-muted text-[10px] max-w-sm mb-4">Link one of your study sets using the form below to collaborate with the group.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {activeRoom.decks.map(deck => (
                          <div 
                            key={deck.id}
                            className="bg-brand-card/45 border border-brand-muted/10 hover:border-brand-primary/30 rounded-2xl p-4.5 shadow-sm transition-all duration-300 flex flex-col justify-between group"
                          >
                            <div>
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="text-xs font-bold text-brand-text truncate max-w-[140px]">{deck.title}</h4>
                                <span className="bg-brand-primary/10 text-brand-primary text-[9px] font-bold px-2 py-0.5 rounded-full">
                                  {deck.flashcards_count} Cards
                                </span>
                              </div>
                              <p className="text-brand-muted text-[10px] line-clamp-3 mb-3 leading-relaxed">
                                {deck.summary || "No notes summary provided for this shared deck."}
                              </p>
                            </div>
                            
                            <div className="flex items-center justify-between border-t border-brand-muted/10 pt-2.5 text-[9px]">
                              <span className="text-brand-muted">Shared by: <strong className="text-brand-text">{deck.creator_name}</strong></span>
                              <a
                                href={`/study/${deck.id}`}
                                className="bg-brand-primary text-white font-bold px-3 py-1.5 rounded-xl hover:scale-105 transition-all flex items-center gap-1 group-hover:shadow-[0_2px_8px_rgba(var(--brand-primary-rgb),0.2)]"
                              >
                                <BookOpen className="w-3 h-3" /> Study
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Inline Share Deck Card */}
                  <div className="bg-brand-card/30 backdrop-blur-md border border-brand-muted/10 rounded-3xl p-6 shadow-sm">
                    <h4 className="text-xs font-bold text-brand-text mb-2">Share one of your decks</h4>
                    <p className="text-brand-muted text-[10px] mb-4">Choose from your personal study sets to make them visible and reviewable for all members of this group.</p>
                    
                    {personalDecks.length === 0 ? (
                      <p className="text-brand-muted text-[10px] bg-brand-muted/5 p-3 rounded-xl text-center border border-brand-muted/10">
                        All your decks have already been shared with this room!
                      </p>
                    ) : (
                      <form onSubmit={handleShareDeck} className="flex flex-col sm:flex-row gap-3">
                        <select
                          value={selectedDeckId}
                          onChange={(e) => setSelectedDeckId(e.target.value)}
                          className="bg-brand-bg/50 border border-brand-muted/15 rounded-xl px-3 py-2 text-xs text-brand-text focus:outline-none focus:border-brand-primary flex-1"
                        >
                          <option value="">-- Select a deck to share --</option>
                          {personalDecks.map(deck => (
                            <option key={deck.id} value={deck.id}>{deck.title} ({deck.flashcards_count || 0} cards)</option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          disabled={!selectedDeckId || actionLoading}
                          className="bg-brand-primary hover:bg-brand-primary/95 text-white rounded-xl px-4 py-2 text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          Share Deck
                        </button>
                      </form>
                    )}
                  </div>

                </div>
                
                {/* Right Side: Leaderboard & Members List (1/3 width) */}
                <div className="flex flex-col gap-6">
                  
                  {/* Leaderboard Card */}
                  <div className="bg-brand-card/30 backdrop-blur-md border border-brand-muted/10 rounded-3xl p-6 shadow-sm">
                    <div className="flex flex-col gap-1 mb-4">
                      <h4 className="text-xs font-bold text-brand-text flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-brand-primary" /> Weekly Leaderboard
                      </h4>
                      <p className="text-brand-muted text-[9px]">Based on mock exam accuracies (Past 7 days)</p>
                    </div>
                    
                    <div className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto no-scrollbar">
                      {leaderboard.map((item, index) => {
                        const isTopThree = index < 3;
                        const badgeColors = ['bg-amber-400 text-amber-950', 'bg-slate-300 text-slate-900', 'bg-amber-600 text-amber-50'];
                        
                        return (
                          <div
                            key={item.user_id}
                            className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                              isTopThree 
                                ? 'bg-brand-card/45 border-brand-primary/20 shadow-sm' 
                                : 'bg-brand-muted/5 border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              {isTopThree ? (
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] ${badgeColors[index]}`}>
                                  {index + 1}
                                </span>
                              ) : (
                                <span className="w-5 h-5 flex items-center justify-center text-[10px] font-bold text-brand-muted">
                                  {index + 1}
                                </span>
                              )}
                              
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-brand-primary/10 flex items-center justify-center text-[9px] font-bold text-brand-primary overflow-hidden">
                                  {item.profile_picture ? (
                                    <img src={item.profile_picture} alt={item.name} className="w-full h-full object-cover" />
                                  ) : (
                                    item.name.slice(0, 2).toUpperCase()
                                  )}
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[11px] font-bold text-brand-text truncate max-w-[90px]">{item.name}</span>
                                  <span className="text-[8px] text-brand-muted">{item.attempts_count} exams</span>
                                </div>
                              </div>
                            </div>
                            
                            <span className="text-xs font-black text-brand-text">{item.avg_accuracy}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Members List Card */}
                  <div className="bg-brand-card/30 backdrop-blur-md border border-brand-muted/10 rounded-3xl p-6 shadow-sm">
                    <h4 className="text-xs font-bold text-brand-text mb-3 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-brand-primary" /> Room Members ({activeRoom.members.length})
                    </h4>
                    
                    <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto no-scrollbar">
                      {activeRoom.members.map(member => (
                        <div key={member.id} className="flex items-center justify-between p-2 rounded-xl bg-brand-muted/5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-brand-primary/10 flex items-center justify-center text-[9px] font-bold text-brand-primary overflow-hidden">
                              {member.profile_picture ? (
                                <img src={member.profile_picture} alt={member.name} className="w-full h-full object-cover" />
                              ) : (
                                member.name.slice(0, 2).toUpperCase()
                              )}
                            </div>
                            <span className="text-[11px] font-medium text-brand-text">{member.name}</span>
                          </div>
                          {activeRoom.creator_id === member.id && (
                            <span className="text-[8px] font-bold text-brand-primary bg-brand-primary/15 px-1.5 py-0.5 rounded">Owner</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>

            </div>
          )}
        </div>

      </div>

      {/* CREATE ROOM MODAL */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-panel p-6 rounded-3xl border border-brand-border shadow-2xl max-w-sm w-full relative bg-brand-surface"
            >
              <button 
                onClick={() => { setShowCreateModal(false); setError(''); setSuccess(''); }} 
                className="absolute top-5 right-5 text-brand-muted hover:text-brand-text cursor-pointer font-bold text-xs"
              >
                ✖
              </button>
              <h3 className="text-sm font-bold text-brand-text mb-4">Create a New Study Group</h3>
              <form onSubmit={handleCreateRoom} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-brand-muted uppercase">Group / Class Name</label>
                  <input 
                    type="text" 
                    value={newRoomName} 
                    onChange={(e) => setNewRoomName(e.target.value)}
                    className="w-full bg-brand-bg/50 border border-brand-muted/15 rounded-xl p-3 text-xs text-brand-text outline-none focus:border-brand-primary"
                    placeholder="e.g. Organic Chemistry 101"
                    required
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={actionLoading}
                  className="w-full py-3 bg-brand-primary text-white font-bold rounded-xl text-xs hover:scale-105 active:scale-95 transition-transform shadow-md cursor-pointer flex items-center justify-center min-h-[40px]"
                >
                  {actionLoading ? 'Creating...' : 'Create Group'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* JOIN ROOM MODAL */}
      <AnimatePresence>
        {showJoinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-panel p-6 rounded-3xl border border-brand-border shadow-2xl max-w-sm w-full relative bg-brand-surface"
            >
              <button 
                onClick={() => { setShowJoinModal(false); setError(''); setSuccess(''); }} 
                className="absolute top-5 right-5 text-brand-muted hover:text-brand-text cursor-pointer font-bold text-xs"
              >
                ✖
              </button>
              <h3 className="text-sm font-bold text-brand-text mb-4">Join an Existing Study Group</h3>
              <form onSubmit={handleJoinRoom} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-brand-muted uppercase">Enter Room Code</label>
                  <input 
                    type="text" 
                    value={roomCode} 
                    onChange={(e) => setRoomCode(e.target.value)}
                    className="w-full bg-brand-bg/50 border border-brand-muted/15 rounded-xl p-3 text-xs text-brand-text outline-none focus:border-brand-primary uppercase"
                    placeholder="e.g. CHEM12"
                    required
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={actionLoading}
                  className="w-full py-3 bg-emerald-500 text-white font-bold rounded-xl text-xs hover:scale-105 active:scale-95 transition-transform shadow-md cursor-pointer flex items-center justify-center min-h-[40px]"
                >
                  {actionLoading ? 'Joining...' : 'Join Group'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
