import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, UserPlus, FileText, Award, LogOut, Copy, Check, ChevronRight, BookOpen, Send, HelpCircle, Loader2 } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState('decks'); // 'decks' | 'leaderboard' | 'share'
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
      
      setActiveTab('decks');
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

  // Copy Room Code to clipboard
  const copyToClipboard = () => {
    if (!activeRoom) return;
    navigator.clipboard.writeText(activeRoom.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
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
            <h3 className="text-sm font-bold text-brand-text mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-brand-primary" /> Study Groups
            </h3>
            
            {/* Joined Rooms List */}
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
              </div>
            ) : rooms.length === 0 ? (
              <p className="text-brand-muted text-xs text-center py-6">You have not joined any study rooms yet.</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-[260px] overflow-y-auto no-scrollbar">
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

          {/* Action Boxes: Create or Join */}
          <div className="bg-brand-card/30 backdrop-blur-md border border-brand-muted/10 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
            {/* Join Room */}
            <form onSubmit={handleJoinRoom} className="flex flex-col gap-2 border-b border-brand-muted/10 pb-4">
              <label className="text-[11px] font-bold text-brand-muted uppercase">Join a Group</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter Room Code"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  className="bg-brand-bg/50 border border-brand-muted/15 rounded-xl px-3 py-2 text-xs w-full focus:outline-none focus:border-brand-primary uppercase"
                />
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-brand-primary hover:bg-brand-primary/95 text-white rounded-xl px-3 py-2 text-xs font-bold transition-all disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
              </div>
            </form>

            {/* Create Room */}
            <form onSubmit={handleCreateRoom} className="flex flex-col gap-2">
              <label className="text-[11px] font-bold text-brand-muted uppercase">Create a Group</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Class/Group Name"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="bg-brand-bg/50 border border-brand-muted/15 rounded-xl px-3 py-2 text-xs w-full focus:outline-none focus:border-brand-primary"
                />
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl px-3 py-2 text-xs font-bold transition-all disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Active study room details */}
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
              <div className="flex gap-3 text-xs font-medium text-brand-muted">
                <div className="flex items-center gap-1.5 bg-brand-muted/5 px-3 py-1.5 rounded-xl">
                  <Plus className="w-4 h-4" /> Create Rooms
                </div>
                <div className="flex items-center gap-1.5 bg-brand-muted/5 px-3 py-1.5 rounded-xl">
                  <UserPlus className="w-4 h-4" /> Join via Code
                </div>
                <div className="flex items-center gap-1.5 bg-brand-muted/5 px-3 py-1.5 rounded-xl">
                  <Award className="w-4 h-4" /> Compete Weekly
                </div>
              </div>
            </div>
          ) : (
            /* Active Study Room Dashboard */
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

                {/* Member avatars list */}
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-2.5 overflow-hidden">
                    {activeRoom.members.slice(0, 4).map((member, idx) => (
                      <div 
                        key={member.id} 
                        className="w-8 h-8 rounded-full border-2 border-brand-card bg-brand-primary/10 flex items-center justify-center text-[10px] font-bold text-brand-primary overflow-hidden"
                        title={member.name}
                      >
                        {member.profile_picture ? (
                          <img src={member.profile_picture} alt={member.name} className="w-full h-full object-cover" />
                        ) : (
                          member.name.slice(0,2).toUpperCase()
                        )}
                      </div>
                    ))}
                    {activeRoom.members.length > 4 && (
                      <div className="w-8 h-8 rounded-full border-2 border-brand-card bg-brand-muted text-white flex items-center justify-center text-[9px] font-bold">
                        +{activeRoom.members.length - 4}
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={handleLeaveRoom}
                    className="flex items-center gap-1 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ml-auto md:ml-0 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Leave Room
                  </button>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-brand-muted/10">
                <button
                  onClick={() => setActiveTab('decks')}
                  className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
                    activeTab === 'decks'
                      ? 'border-brand-primary text-brand-primary'
                      : 'border-transparent text-brand-muted hover:text-brand-text'
                  }`}
                >
                  Decks & Notes ({activeRoom.decks.length})
                </button>
                <button
                  onClick={() => setActiveTab('leaderboard')}
                  className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                    activeTab === 'leaderboard'
                      ? 'border-brand-primary text-brand-primary'
                      : 'border-transparent text-brand-muted hover:text-brand-text'
                  }`}
                >
                  <Award className="w-4 h-4" /> Room Leaderboard
                </button>
                <button
                  onClick={() => setActiveTab('share')}
                  className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                    activeTab === 'share'
                      ? 'border-brand-primary text-brand-primary'
                      : 'border-transparent text-brand-muted hover:text-brand-text'
                  }`}
                >
                  <Send className="w-4 h-4" /> Share Decks
                </button>
              </div>

              {/* Active Tab Panel Content */}
              <div className="min-h-[300px]">
                
                {/* Tab: Decks List */}
                {activeTab === 'decks' && (
                  <div className="flex flex-col gap-4">
                    {activeRoom.decks.length === 0 ? (
                      <div className="bg-brand-card/25 border border-brand-muted/10 rounded-2xl p-8 text-center flex flex-col items-center justify-center">
                        <FileText className="w-10 h-10 text-brand-muted mb-2 opacity-50" />
                        <h4 className="text-xs font-bold text-brand-text mb-1">No shared decks yet</h4>
                        <p className="text-brand-muted text-[11px] max-w-sm mb-4">Get started by sharing your study sets or summaries to collaborate on class resources.</p>
                        <button 
                          onClick={() => setActiveTab('share')} 
                          className="bg-brand-primary hover:bg-brand-primary/90 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer"
                        >
                          Share Your First Deck
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {activeRoom.decks.map(deck => (
                          <div 
                            key={deck.id}
                            className="bg-brand-card/30 border border-brand-muted/10 hover:border-brand-primary/30 rounded-2xl p-5 shadow-sm transition-all duration-300 flex flex-col justify-between group"
                          >
                            <div>
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="text-sm font-bold text-brand-text truncate max-w-[200px]">{deck.title}</h4>
                                <span className="bg-brand-primary/10 text-brand-primary text-[10px] font-bold px-2 py-0.5 rounded-full">
                                  {deck.flashcards_count} Cards
                                </span>
                              </div>
                              <p className="text-brand-muted text-[11px] line-clamp-3 mb-4 leading-relaxed">
                                {deck.summary || "No notes summary provided for this shared deck."}
                              </p>
                            </div>
                            
                            <div className="flex items-center justify-between border-t border-brand-muted/10 pt-3 text-[10px]">
                              <span className="text-brand-muted">Shared by: <strong className="text-brand-text">{deck.creator_name}</strong></span>
                              <a
                                href={`/study/${deck.id}`}
                                className="bg-brand-primary text-white font-bold px-3 py-1.5 rounded-xl hover:scale-105 transition-all flex items-center gap-1 group-hover:shadow-[0_2px_8px_rgba(var(--brand-primary-rgb),0.2)]"
                              >
                                <BookOpen className="w-3.5 h-3.5" /> Study Deck
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Leaderboard */}
                {activeTab === 'leaderboard' && (
                  <div className="bg-brand-card/25 border border-brand-muted/10 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex flex-col gap-0.5">
                        <h4 className="text-xs font-bold text-brand-text">Weekly Accuracy Leaderboard</h4>
                        <p className="text-brand-muted text-[10px]">Calculated based on mock exam scores in the last 7 days.</p>
                      </div>
                      <span className="bg-brand-primary/10 text-brand-primary text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase">Weekly Reset</span>
                    </div>

                    <div className="flex flex-col gap-3">
                      {leaderboard.map((item, index) => {
                        const isTopThree = index < 3;
                        const badgeColors = ['bg-amber-400 text-amber-950', 'bg-slate-300 text-slate-900', 'bg-amber-600 text-amber-50'];
                        
                        return (
                          <div
                            key={item.user_id}
                            className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                              isTopThree 
                                ? 'bg-brand-card/45 border-brand-primary/20 shadow-sm' 
                                : 'bg-brand-muted/5 border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-3.5">
                              {/* Rank badge */}
                              {isTopThree ? (
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs ${badgeColors[index]}`}>
                                  {index + 1}
                                </span>
                              ) : (
                                <span className="w-6 h-6 flex items-center justify-center text-xs font-bold text-brand-muted">
                                  {index + 1}
                                </span>
                              )}

                              {/* Member Avatar and Details */}
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center text-[10px] font-bold text-brand-primary overflow-hidden">
                                  {item.profile_picture ? (
                                    <img src={item.profile_picture} alt={item.name} className="w-full h-full object-cover" />
                                  ) : (
                                    item.name.slice(0, 2).toUpperCase()
                                  )}
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-xs font-bold text-brand-text">{item.name}</span>
                                  <span className="text-[9px] text-brand-muted">{item.attempts_count} quiz attempts this week</span>
                                </div>
                              </div>
                            </div>

                            {/* Accuracy score */}
                            <div className="flex items-center gap-2">
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="text-sm font-black text-brand-text">{item.avg_accuracy}%</span>
                                <span className="text-[9px] text-brand-muted">Accuracy</span>
                              </div>
                              {/* Simple Mini Ring Progress bar */}
                              <div className="w-8 h-8 rounded-full border-4 border-brand-muted/10 relative flex items-center justify-center">
                                <div 
                                  className="absolute inset-[-4px] rounded-full border-4 border-brand-primary/30" 
                                  style={{ clipPath: `polygon(50% 50%, 50% 0%, ${item.avg_accuracy >= 25 ? '100% 0%,' : ''} ${item.avg_accuracy >= 50 ? '100% 100%,' : ''} ${item.avg_accuracy >= 75 ? '0% 100%,' : ''} 0% 0%)` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tab: Share Decks dropdown */}
                {activeTab === 'share' && (
                  <div className="bg-brand-card/25 border border-brand-muted/10 rounded-2xl p-6 shadow-sm max-w-lg">
                    <h4 className="text-xs font-bold text-brand-text mb-2">Link Personal Deck to Study Group</h4>
                    <p className="text-brand-muted text-[10px] mb-4">
                      Share any deck you have generated or uploaded. Once shared, all group members will be able to review, study, and complete quiz challenges for this deck.
                    </p>

                    {personalDecks.length === 0 ? (
                      <p className="text-brand-muted text-xs bg-brand-muted/5 p-4 rounded-xl text-center border border-brand-muted/10">
                        You don't have any personal decks available to share (or they are all already shared in this room).
                      </p>
                    ) : (
                      <form onSubmit={handleShareDeck} className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-bold text-brand-muted uppercase">Select a Study Deck</label>
                          <select
                            value={selectedDeckId}
                            onChange={(e) => setSelectedDeckId(e.target.value)}
                            className="bg-brand-bg/50 border border-brand-muted/15 rounded-xl px-3 py-2.5 text-xs text-brand-text focus:outline-none focus:border-brand-primary"
                          >
                            <option value="">-- Choose from your decks --</option>
                            {personalDecks.map(deck => (
                              <option key={deck.id} value={deck.id}>{deck.title} ({deck.flashcards_count || 0} cards)</option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="submit"
                          disabled={!selectedDeckId || actionLoading}
                          className="bg-brand-primary hover:bg-brand-primary/95 text-white rounded-xl py-2.5 text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Send className="w-4 h-4" /> Share Deck with Room
                        </button>
                      </form>
                    )}
                  </div>
                )}

              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
