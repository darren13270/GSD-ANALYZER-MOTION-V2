import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { AnalysisResult, Cycle, MotionAnalysis } from '../types';

interface TimelineEditorProps {
  cycle: Cycle;
  cycleIndex: number;
  videoDuration: number;
  videoRef: React.RefObject<HTMLVideoElement>;
  onUpdateResult: (result: AnalysisResult) => void;
  result: AnalysisResult;
  activeMotionId: string | null;
  onSelectMotion: (motionId: string | null) => void;
}

export const TimelineEditor: React.FC<TimelineEditorProps> = ({
  cycle,
  cycleIndex,
  videoDuration,
  videoRef,
  onUpdateResult,
  result,
  activeMotionId,
  onSelectMotion
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<{ motionIdx: number; type: 'start' | 'end' | 'both' } | null>(null);

  // Constants
  const colors = ['bg-[#0066FF]', 'bg-[#20C997]', 'bg-[#6F42C1]', 'bg-[#FD7E14]', 'bg-[#E83E8C]'];

  // Zoomed window based on cycle boundaries plus some padding
  const cycleStart = cycle.motions.length > 0 ? cycle.motions[0].startTime : 0;
  const cycleEnd = cycle.motions.length > 0 ? cycle.motions[cycle.motions.length - 1].endTime : videoDuration;
  const padding = Math.max(2, (cycleEnd - cycleStart) * 0.1);
  const viewStart = Math.max(0, cycleStart - padding);
  const viewEnd = Math.min(videoDuration, cycleEnd + padding);
  const viewDuration = viewEnd - viewStart;

  const getPos = (time: number) => ((time - viewStart) / viewDuration) * 100;
  const getTime = (posPercent: number) => (posPercent / 100) * viewDuration + viewStart;

  const handleMouseDown = (motionIdx: number, type: 'start' | 'end' | 'both', e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging({ motionIdx, type });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current || !result) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const posPercent = Math.max(0, Math.min(100, (x / rect.width) * 100));
      const newTime = getTime(posPercent);

      // Snap to frames (assuming 30fps)
      const snappedTime = Math.round(newTime * 30) / 30;

      const updatedResult = JSON.parse(JSON.stringify(result)) as AnalysisResult;
      const currentCycle = updatedResult.cycles[cycleIndex];
      const motion = currentCycle.motions[isDragging.motionIdx];
      
      if (isDragging.type === 'start') {
        const prevMotion = currentCycle.motions[isDragging.motionIdx - 1];
        const minTime = prevMotion ? prevMotion.startTime + 0.1 : 0;
        const maxTime = motion.endTime - 0.1;
        const constrainedTime = Math.max(minTime, Math.min(maxTime, snappedTime));
        
        motion.startTime = constrainedTime;
        if (prevMotion) prevMotion.endTime = constrainedTime;
      } else if (isDragging.type === 'end') {
        const nextMotion = currentCycle.motions[isDragging.motionIdx + 1];
        const minTime = motion.startTime + 0.1;
        const maxTime = nextMotion ? nextMotion.endTime - 0.1 : videoDuration;
        const constrainedTime = Math.max(minTime, Math.min(maxTime, snappedTime));
        
        motion.endTime = constrainedTime;
        if (nextMotion) nextMotion.startTime = constrainedTime;
      }

      // Recalculate all durations and TMUs for the cycle
      currentCycle.motions.forEach(m => {
        m.duration = Math.max(0, m.endTime - m.startTime);
        m.tmu = m.duration * 27.8;
      });
      currentCycle.totalTmu = currentCycle.motions.reduce((sum, m) => sum + m.tmu, 0);

      // Global stats
      const validCycles = updatedResult.cycles.filter(c => c.motions.length > 0);
      if (validCycles.length > 0) {
        const avgTmu = validCycles.reduce((sum, c) => sum + c.totalTmu, 0) / validCycles.length;
        updatedResult.totalSmv = avgTmu * 0.0006 * 1.15;
        updatedResult.averageCycleTime = validCycles.reduce((sum, c) => sum + c.motions.reduce((s, m) => s + m.duration, 0), 0) / validCycles.length;
      }

      onUpdateResult(updatedResult);

      // Preview video frame
      if (videoRef.current) {
        videoRef.current.currentTime = snappedTime;
      }
    };

    const handleMouseUp = () => {
      setIsDragging(null);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, cycleIndex, result, viewStart, viewDuration]);

  return (
    <div className="px-6 py-4 bg-[#F8F9FA] border-b border-[#E9ECEF]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-[#6C757D] uppercase tracking-wider">Drag boundaries to adjust timing</span>
        <span className="text-[10px] font-mono text-[#6C757D]">Zoom: {viewStart.toFixed(1)}s - {viewEnd.toFixed(1)}s</span>
      </div>
      <div 
        ref={containerRef}
        className="h-12 bg-white rounded-lg border border-[#DEE2E6] relative shadow-sm overflow-visible"
      >
        {/* Background Ticks */}
        <div className="absolute inset-0 pointer-events-none flex justify-between px-1">
          {Array.from({ length: 11 }).map((_, i) => (
            <div key={i} className="h-full border-l border-[#E9ECEF] last:border-r" />
          ))}
        </div>

        {/* Motion Blocks */}
        {cycle.motions.map((motion, mIdx) => {
          const left = getPos(motion.startTime);
          const width = getPos(motion.endTime) - left;
          const color = colors[mIdx % colors.length];
          const isActive = motion.id === activeMotionId;

          return (
            <div
              key={motion.id}
              className={`absolute h-full ${color} ${isActive ? 'opacity-70 ring-2 ring-inset ring-black z-10' : 'opacity-30'} border-x border-white/20 flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-50 transition-all`}
              style={{ left: `${left}%`, width: `${width}%` }}
              onClick={() => {
                onSelectMotion(motion.id);
                if (videoRef.current) {
                  videoRef.current.currentTime = motion.startTime;
                }
              }}
            >
              <span className={`text-[9px] font-bold truncate px-1 ${isActive ? 'text-black' : 'text-black/60'}`}>
                {motion.gsdCode}
              </span>
            </div>
          );
        })}

        {/* Drag Handles */}
        {cycle.motions.map((motion, mIdx) => {
          const startX = getPos(motion.startTime);
          const endX = getPos(motion.endTime);

          return (
            <React.Fragment key={`handle-${motion.id}`}>
              {/* Start Handle (only show for the very first motion of the cycle) */}
              {mIdx === 0 && (
                <div 
                  className="absolute top-0 bottom-0 w-2 -ml-1 cursor-ew-resize z-30 group"
                  style={{ left: `${startX}%` }}
                  onMouseDown={(e) => handleMouseDown(mIdx, 'start', e)}
                >
                  <div className="absolute inset-y-0 left-1/2 w-0.5 bg-[#0066FF] group-hover:w-1 group-hover:bg-[#0052CC] transition-all" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-[#0066FF] rounded-full scale-0 group-hover:scale-100 transition-transform" />
                </div>
              )}

              {/* End / Intermediate Handle */}
              <div 
                className="absolute top-0 bottom-0 w-2 -ml-1 cursor-ew-resize z-30 group"
                style={{ left: `${endX}%` }}
                onMouseDown={(e) => handleMouseDown(mIdx, 'end', e)}
              >
                <div className="absolute inset-y-0 left-1/2 w-0.5 bg-[#0066FF] group-hover:w-1 group-hover:bg-[#0052CC] transition-all" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-[#0066FF] rounded-full scale-0 group-hover:scale-100 transition-transform" />
              </div>
            </React.Fragment>
          );
        })}
      </div>
      <div className="flex justify-between mt-1 text-[10px] font-mono text-[#ADB5BD]">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i}>{(viewStart + (i * viewDuration / 5)).toFixed(1)}s</span>
        ))}
      </div>
    </div>
  );
};
