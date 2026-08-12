import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api';
import { Calendar, Info } from 'lucide-react';

export default function ContributionHeatmap() {
  const [activityMap, setActivityMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [hoveredDay, setHoveredDay] = useState(null);

  useEffect(() => {
    const fetchHeatmap = async () => {
      try {
        const res = await api.get('/api/user-stats/activity/heatmap');
        setActivityMap(res.data || {});
      } catch (err) {
        console.warn('Failed to load heatmap data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHeatmap();
  }, []);

  // Generate 365 days ending today
  const calendarGrid = useMemo(() => {
    const grid = [];
    const today = new Date();
    
    // We want the grid to represent 53 weeks.
    // Calculate the date 364 days ago (which aligns to 53 full weeks)
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 364);

    // Find the day of the week for the start date to offset if needed
    // 0: Sunday, 1: Monday, ... 6: Saturday
    let current = new Date(startDate);
    
    // Loop through 365 days
    for (let i = 0; i < 365; i++) {
      const dateStr = current.toISOString().split('T')[0];
      const count = activityMap[dateStr] || 0;
      
      grid.push({
        date: new Date(current),
        dateStr,
        count,
      });
      
      current.setDate(current.getDate() + 1);
    }
    
    return grid;
  }, [activityMap]);

  // Group days into weeks (columns of 7 days)
  const weeks = useMemo(() => {
    const cols = [];
    let currentWeek = [];
    
    calendarGrid.forEach((day, index) => {
      currentWeek.push(day);
      if (currentWeek.length === 7 || index === calendarGrid.length - 1) {
        cols.push(currentWeek);
        currentWeek = [];
      }
    });
    
    return cols;
  }, [calendarGrid]);

  // Determine contribution color class
  const getColorClass = (count) => {
    if (count === 0) return 'bg-brand-muted/20 dark:bg-brand-muted/10';
    if (count === 1) return 'bg-emerald-500/30 text-emerald-500';
    if (count === 2) return 'bg-emerald-500/50 text-emerald-400';
    if (count === 3) return 'bg-emerald-500/80 text-white';
    return 'bg-emerald-500 text-white shadow-[0_0_8px_rgba(16,185,129,0.4)]';
  };

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // Calculate month labels position (first day of each month in the grid)
  const monthLabels = useMemo(() => {
    const labels = [];
    let lastMonth = -1;
    
    weeks.forEach((week, weekIndex) => {
      const firstDayOfWeek = week[0]?.date;
      if (firstDayOfWeek) {
        const currentMonth = firstDayOfWeek.getMonth();
        if (currentMonth !== lastMonth) {
          labels.push({
            name: months[currentMonth],
            index: weekIndex,
          });
          lastMonth = currentMonth;
        }
      }
    });
    
    return labels;
  }, [weeks]);

  if (loading) {
    return (
      <div className="bg-brand-card/30 backdrop-blur-md border border-brand-muted/10 rounded-2xl p-6 flex flex-col items-center justify-center h-[220px]">
        <Calendar className="w-8 h-8 animate-pulse text-brand-muted mb-2" />
        <span className="text-brand-muted text-xs animate-pulse font-medium">Loading activity timeline...</span>
      </div>
    );
  }

  return (
    <div className="bg-brand-card/30 backdrop-blur-md border border-brand-muted/10 rounded-2xl p-6 shadow-sm relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-brand-primary" />
          <h3 className="text-sm font-semibold text-brand-text">Annual Study Timeline</h3>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-brand-muted font-medium bg-brand-muted/5 px-2 py-0.5 rounded-full">
          <Info className="w-3.5 h-3.5" /> Hover nodes for session logs
        </div>
      </div>

      {/* Heatmap Container */}
      <div className="relative overflow-x-auto select-none no-scrollbar pb-2">
        <div className="min-w-[720px] flex flex-col relative pr-4">
          
          {/* Month Labels row */}
          <div className="flex mb-1.5 text-[10px] text-brand-muted font-semibold relative h-4">
            {monthLabels.map((lbl, idx) => (
              <span 
                key={idx} 
                style={{ 
                  position: 'absolute', 
                  left: `${lbl.index * 13.5}px` 
                }}
              >
                {lbl.name}
              </span>
            ))}
          </div>

          <div className="flex gap-[3.5px]">
            {/* Weekday labels col */}
            <div className="flex flex-col justify-around text-[9px] text-brand-muted/65 font-bold w-6 h-[88px] pr-1 select-none">
              <span>Mon</span>
              <span>Wed</span>
              <span>Fri</span>
            </div>

            {/* Heatmap Grid */}
            <div className="flex gap-[3px]">
              {weeks.map((week, weekIdx) => (
                <div key={weekIdx} className="flex flex-col gap-[3px]">
                  {week.map((day, dayIdx) => (
                    <div
                      key={dayIdx}
                      className={`w-[10px] h-[10px] rounded-[2px] transition-all duration-200 cursor-pointer hover:scale-125 hover:z-10 ${getColorClass(day.count)}`}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredDay({
                          dateStr: day.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
                          count: day.count,
                          top: rect.top - 120, // offset
                          left: rect.left - 380,
                        });
                      }}
                      onMouseLeave={() => setHoveredDay(null)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Map Legend */}
          <div className="flex justify-end items-center gap-1.5 mt-3 text-[10px] text-brand-muted pr-2">
            <span>Less</span>
            <div className="w-2.5 h-2.5 rounded-[2px] bg-brand-muted/20 dark:bg-brand-muted/10" />
            <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-500/30" />
            <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-500/50" />
            <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-500/80" />
            <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-500" />
            <span>More</span>
          </div>
        </div>
      </div>

      {/* Tooltip render */}
      <AnimatePresence>
        {hoveredDay && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.15 }}
            style={{ 
              position: 'fixed',
              top: hoveredDay.top,
              left: hoveredDay.left,
              pointerEvents: 'none',
              zIndex: 100
            }}
            className="bg-brand-card/95 border border-brand-muted/20 backdrop-blur-md px-3 py-1.5 rounded-lg shadow-xl text-xs font-semibold text-brand-text flex flex-col gap-0.5"
          >
            <span className="text-[10px] text-brand-muted font-bold uppercase">{hoveredDay.dateStr}</span>
            <span>{hoveredDay.count === 0 ? 'No study sessions' : `${hoveredDay.count} study session${hoveredDay.count > 1 ? 's' : ''}`}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
