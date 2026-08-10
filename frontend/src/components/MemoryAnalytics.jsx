import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { BrainCircuit, Loader2, Target, CalendarDays, BarChart2 } from 'lucide-react';
import api from '../lib/api';

export default function MemoryAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMemoryData = async () => {
      try {
        const res = await api.get('/api/analytics/memory');
        setData(res.data);
      } catch (error) {
        console.error('Failed to fetch memory analytics', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMemoryData();
  }, []);

  if (loading) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-brand-surface border border-brand-border rounded-3xl">
        <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
      </div>
    );
  }

  if (!data || data.total_cards === 0) {
    return (
      <div className="w-full p-8 bg-brand-surface border border-brand-border rounded-3xl text-center">
        <BrainCircuit className="w-12 h-12 text-brand-muted mx-auto mb-4 opacity-50" />
        <h3 className="text-xl font-medium mb-2 text-brand-text">No Memory Data Yet</h3>
        <p className="text-brand-muted">Start reviewing flashcards to build your personalized forgetting curve.</p>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full bg-brand-surface border border-brand-border rounded-3xl overflow-hidden shadow-lg"
    >
      <div className="p-6 sm:p-8 border-b border-brand-border bg-gradient-to-r from-brand-primary/5 to-transparent">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-brand-primary/20 rounded-lg text-brand-primary">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-brand-text">FSRS Memory Analytics</h2>
        </div>
        <p className="text-brand-muted text-sm ml-11">
          Powered by the Free Spaced Repetition Scheduler algorithm.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-6 sm:p-8 border-b border-brand-border bg-brand-bg">
        <div className="bg-brand-surface p-4 rounded-2xl border border-brand-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
            <BarChart2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-brand-muted font-medium">Active Cards</p>
            <p className="text-2xl font-bold text-brand-text">{data.active_cards} <span className="text-xs text-brand-muted font-normal">/ {data.total_cards}</span></p>
          </div>
        </div>

        <div className="bg-brand-surface p-4 rounded-2xl border border-brand-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-brand-muted font-medium">Due Today</p>
            <p className="text-2xl font-bold text-brand-text">{data.cards_due_today}</p>
          </div>
        </div>

        <div className="bg-brand-surface p-4 rounded-2xl border border-brand-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 shrink-0">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-brand-muted font-medium">Avg. Stability</p>
            <p className="text-2xl font-bold text-brand-text">{data.average_stability} <span className="text-sm font-normal text-brand-muted">days</span></p>
          </div>
        </div>
      </div>

      {data.forgetting_curve && data.forgetting_curve.length > 0 && (
        <div className="p-6 sm:p-8">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-brand-text mb-1">Your Forgetting Curve</h3>
            <p className="text-sm text-brand-muted">
              Mathematically predicted retention probability over the next 30 days based on your current memory stability.
            </p>
          </div>
          
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data.forgetting_curve}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="day" 
                  stroke="#6b7280" 
                  tick={{ fill: '#6b7280', fontSize: 12 }} 
                  tickFormatter={(val) => `Day ${val}`}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis 
                  stroke="#6b7280" 
                  tick={{ fill: '#6b7280', fontSize: 12 }} 
                  tickFormatter={(val) => `${val}%`}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 100]}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '12px', color: '#f3f4f6' }}
                  itemStyle={{ color: '#8b5cf6', fontWeight: 'bold' }}
                  formatter={(value) => [`${value}%`, 'Probability of Recall']}
                  labelFormatter={(label) => `Day ${label}`}
                />
                <ReferenceLine y={90} stroke="#22c55e" strokeDasharray="3 3" opacity={0.5} label={{ position: 'top', value: 'Optimal Review Target (90%)', fill: '#22c55e', fontSize: 10, opacity: 0.8 }} />
                <Line 
                  type="monotone" 
                  dataKey="retention" 
                  stroke="#8b5cf6" 
                  strokeWidth={4}
                  dot={false}
                  activeDot={{ r: 6, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 }}
                  animationDuration={1500}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </motion.div>
  );
}
