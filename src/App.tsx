/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, ChangeEvent, useEffect } from 'react';
import { 
  Upload, 
  Play, 
  Activity, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  ChevronDown,
  FileVideo,
  BarChart3,
  Timer,
  BookOpen,
  Search,
  Download,
  Film,
  Maximize,
  Pencil,
  X,
  Save,
  Share2,
  LogOut,
  LogIn,
  Trash2,
  Plus,
  FileText,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Undo2
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { analyzeOperationVideo } from './services/geminiService';
import { AnalysisResult, Cycle, MotionAnalysis } from './types';
import { TimelineEditor } from './components/TimelineEditor';
import { DrivePickerButton } from './components/DrivePickerButton';
import { db, auth, loginWithGoogle, logout, handleFirestoreError, OperationType } from './firebase';
import { collection, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import * as Mp4Muxer from 'mp4-muxer';

const GSD_CODES = [
  { code: 'GP1E', desc: 'Get Part 1 Hand (Easy)' },
  { code: 'GP1H', desc: 'Get Part 1 Hand (Normal)' },
  { code: 'GP2H', desc: 'Get Part 2 Hands' },
  { code: 'MG2S', desc: 'Match & Get 2 Parts Separately' },
  { code: 'MG2T', desc: 'Match & Get 2 Parts Together' },
  { code: 'MAP1', desc: 'Match & Add Part (1 Hand)' },
  { code: 'MAP2', desc: 'Match & Add Part (2 Hands)' },
  { code: 'MAPE', desc: 'Match & Add Part (Easy)' },
  { code: 'GPP1', desc: 'Get Part & Position (1H)' },
  { code: 'GPP2', desc: 'Get Part & Position (2H)' },
  { code: 'REGP', desc: 'Regrasp Part' },
  { code: 'FOOT', desc: 'Move Part to Presser Foot' },
  { code: 'AM2P', desc: 'Align & Match 2 Parts' },
  { code: 'AJPT', desc: 'Align & Adjust 1 Part (Top)' },
  { code: 'ARPN', desc: 'Align & Reposition' },
  { code: 'APSH', desc: 'Align by Pushing/Sliding' },
  { code: 'GTRM', desc: 'Get Trim (Zipper/Label)' },
  { code: 'MGTB', desc: 'Match & Get Trim to Body' },
  { code: 'HNDL', desc: 'Handling (Pick up / Dispose)' },
  { code: 'MBTB', desc: 'Backtack at Begin (Lever)' },
  { code: 'MBTE', desc: 'Backtack at End (Lever)' },
  { code: 'MBAB', desc: 'Backtack at Begin (Auto)' },
  { code: 'MBAE', desc: 'Backtack at End (Auto)' },
  { code: 'TPRS', desc: 'Toggle Presser Foot' },
  { code: 'TTRM', desc: 'Auto Thread Trimmer' },
  { code: 'TBLD', desc: 'Trim with Fixed Blade' },
  { code: 'MS1A', desc: 'Machine Sew > 1cm (Approx)' },
  { code: 'MS1B', desc: 'Machine Sew < 1cm (Accurate)' },
  { code: 'MCON', desc: 'Constant Speed Sewing' },
  { code: 'MHLD', desc: 'Hold & Support Assembly' },
  { code: 'MTRN', desc: 'Machine Turn (Pivot)' },
  { code: 'STPD', desc: 'Stop & Position Needle' },
  { code: 'SEW_S', desc: 'Sewing Small (< 5cm, Tacks)' },
  { code: 'SEW_M', desc: 'Sewing Medium (General Curves)' },
  { code: 'SEW_L', desc: 'Sewing Low/Long (Straight)' },
  { code: 'SEW_H', desc: 'Sewing High (Complex/Corners)' },
  { code: 'FFLD', desc: 'Form Fold' },
  { code: 'FCRS', desc: 'Form Crease' },
  { code: 'TCUT', desc: 'Trim with Scissors (1st)' },
  { code: 'TCAT', desc: 'Trim with Scissors (Add)' },
  { code: 'TRIM', desc: 'Trimming (Align Cut)' },
  { code: 'TDCH', desc: 'De-chain with Scissors' },
  { code: 'FUNF', desc: 'Form Unfold' },
  { code: 'FOLD', desc: 'Folding (Hem/Part)' },
  { code: 'TURN', desc: 'Turn Part' },
  { code: 'MARK', desc: 'Marking (Chalk/Pen)' },
  { code: 'NOTC', desc: 'Notch' },
  { code: 'PICK', desc: 'Pick up Tool' },
  { code: 'PLCE', desc: 'Place Tool Down' },
  { code: 'SHAK', desc: 'Shake Part' },
  { code: 'BURP', desc: 'Burp (Release Air)' },
  { code: 'MEAS', desc: 'Measurement (Check Spec)' },
  { code: 'INSP', desc: 'Inspect Part (Visual)' },
  { code: 'TICK', desc: 'Attach Ticket/Sticker' },
  { code: 'CSTR', desc: 'Clip Thread (Single)' },
  { code: 'WIPE', desc: 'Wipe Surface' },
  { code: 'STMP', desc: 'Stamp Part' },
  { code: 'BNDL', desc: 'Open/Close Bundle' },
  { code: 'AS1H', desc: 'Aside Part (1 Hand)' },
  { code: 'AS2H', desc: 'Aside Part (2 Hands)' },
  { code: 'ASTK', desc: 'Aside & Stack' },
  { code: 'ASPH', desc: 'Aside by Pushing' },
  { code: 'ATOS', desc: 'Aside by Tossing' },
  { code: 'ABDL', desc: 'Aside & Bundle' },
  { code: 'ASFT', desc: 'Aside to Floor/Table' },
  { code: 'AHNG', desc: 'Hang Part on Rail' },
  { code: 'CYCL', desc: 'Machine Cycle (Stop/Start/Trim)' },
  { code: 'IRON', desc: 'Ironing (Steam/Press)' },
];

export default function App() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoFile2, setVideoFile2] = useState<File | null>(null);
  const [videoUrl2, setVideoUrl2] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [expectedCycles, setExpectedCycles] = useState<number>(3);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number | undefined>(undefined);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedCycle, setExpandedCycle] = useState<number | null>(0);
  const [showReference, setShowReference] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeMotionId, setActiveMotionId] = useState<string | null>(null);
  const [activeCycleNumber, setActiveCycleNumber] = useState<number | null>(null);
  const [activeMotionsOverlay, setActiveMotionsOverlay] = useState<MotionAnalysis[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [operationName, setOperationName] = useState('');
  const [styleNumber, setStyleNumber] = useState('');
  const [skillGrade, setSkillGrade] = useState(80);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [tempOperationName, setTempOperationName] = useState('');
  const [tempStyleNumber, setTempStyleNumber] = useState('');
  const [tempSkillGrade, setTempSkillGrade] = useState(80);
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  
  const [user, setUser] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [hasValidApiKey, setHasValidApiKey] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoRef2 = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  
  const lastTimeRef = useRef<number>(0);
  const lastMotionIdRef = useRef<string | null>(null);
  const analysisAbortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Check if running in AI studio window and prompt for API key if missing
    if (window.aistudio && window.aistudio.hasSelectedApiKey) {
      window.aistudio.hasSelectedApiKey().then((hasKey: boolean) => {
        setHasValidApiKey(hasKey);
      }).catch(console.error);
    }
  }, []);

  const handleSelectApiKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      try {
        await window.aistudio.openSelectKey();
        setHasValidApiKey(true);
      } catch (err) {
        console.error("Failed to select API key", err);
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.code === 'Space') {
        e.preventDefault();
        if (videoRef.current) {
          if (videoRef.current.paused) videoRef.current.play();
          else videoRef.current.pause();
        }
      } else if (e.code === 'ArrowRight') {
        if (videoRef.current) videoRef.current.currentTime += 0.033;
      } else if (e.code === 'ArrowLeft') {
        if (videoRef.current) videoRef.current.currentTime -= 0.033;
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (e.shiftKey && e.code === 'KeyN') {
        if (result && result.cycles.length > 0) {
          handleAddMotion(0);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [result, history]);

  const getCacheKey = async () => {
    if (!videoFile) return null;
    
    // Create a robust fingerprint that NEVER depends on the filename
    // Fallback manual hash function if crypto API is somehow blocked
    const fallbackHash = async (buffer: ArrayBuffer) => {
      const view = new Uint8Array(buffer);
      let hash = 0;
      for (let i = 0; i < view.length; i++) {
        hash = ((hash << 5) - hash) + view[i];
        hash |= 0; // Convert to 32bit int
      }
      return Math.abs(hash).toString(16);
    };

    try {
      const slice = videoFile.slice(0, 1024 * 1024);
      const arrayBuffer = await slice.arrayBuffer();
      
      let hashHex;
      if (crypto && crypto.subtle) {
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } else {
        hashHex = await fallbackHash(arrayBuffer);
      }
      
      // Include operationName so if users change the context, it re-analyzes specifically for that context, 
      // preventing confusing mismatches where the AI's label doesn't match the new description.
      // But we sanitize operationName so it forms a clean key.
      const safeOpName = (operationName || "default").replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
      
      // Versioned key to allow system-wide resets for logic updates
      return `v9-gsd-analysis-${hashHex}-${videoFile.size}-cycles-${expectedCycles}`;
    } catch (e) {
      console.warn("Hashing failed, using size and modified date as fallback key");
      // Absolute final fallback: size and modified timestamp, but ZERO reliance on filename.
      return `v9-gsd-analysis-fallback-${videoFile.size}-${videoFile.lastModified || '0'}-cycles-${expectedCycles}`;
    }
  };

  const updateResultWithHistory = (newResult: AnalysisResult) => {
    if (result) {
      setHistory(prev => [...prev.slice(-19), JSON.parse(JSON.stringify(result))]);
    }
    setResult(newResult);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setResult(previous);
    setHistory(prev => prev.slice(0, -1));
  };

  const handleUpdateMotionCode = (cycleIndex: number, motionIndex: number, newCode: string) => {
    if (!result) return;
    
    const newDesc = getGsdDescription(newCode);
    
    const updatedResult = JSON.parse(JSON.stringify(result)) as AnalysisResult;
    updatedResult.cycles[cycleIndex].motions[motionIndex].gsdCode = newCode;
    updatedResult.cycles[cycleIndex].motions[motionIndex].motionDescription = newDesc;
    
    updateResultWithHistory(updatedResult);
  };

  const handleUpdateMotionTime = (cycleIndex: number, motionIndex: number, field: 'startTime' | 'endTime', value: string) => {
    if (!result) return;
    
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) return;

    const updatedResult = JSON.parse(JSON.stringify(result)) as AnalysisResult;
    const motion = updatedResult.cycles[cycleIndex].motions[motionIndex];
    
    if (field === 'startTime') {
      motion.startTime = numValue;
    } else {
      motion.endTime = numValue;
    }
    
    // Recalculate duration and TMU
    motion.duration = Math.max(0, motion.endTime - motion.startTime);
    motion.tmu = motion.duration * 27.8;
    
    // Recalculate cycle total TMU
    updatedResult.cycles[cycleIndex].totalTmu = updatedResult.cycles[cycleIndex].motions.reduce((sum, m) => sum + m.tmu, 0);
    
    // Recalculate overall average and total
    const validCycles = updatedResult.cycles.filter(c => c.motions.length > 0);
    if (validCycles.length > 0) {
      const avgTmu = validCycles.reduce((sum, c) => sum + c.totalTmu, 0) / validCycles.length;
      updatedResult.totalSmv = avgTmu * 0.0006 * 1.15;
      updatedResult.averageCycleTime = validCycles.reduce((sum, c) => sum + c.motions.reduce((s, m) => s + m.duration, 0), 0) / validCycles.length;
    } else {
      updatedResult.totalSmv = 0;
      updatedResult.averageCycleTime = 0;
    }
    
    updateResultWithHistory(updatedResult);
  };

  const handleAddMotion = (cycleIndex: number, insertAt?: number) => {
    if (!result) return;
    
    const updatedResult = JSON.parse(JSON.stringify(result)) as AnalysisResult;
    const cycle = updatedResult.cycles[cycleIndex];
    
    let startTime = 0;
    let endTime = 1;

    if (insertAt !== undefined && cycle.motions[insertAt]) {
      // Insert at specific index
      startTime = cycle.motions[insertAt].startTime;
      endTime = startTime + 0.5; // Default short duration for insertion
    } else {
      // Append to end
      const lastMotion = cycle.motions[cycle.motions.length - 1];
      startTime = lastMotion ? lastMotion.endTime : 0;
      endTime = startTime + 1;
    }
    
    const newMotion: MotionAnalysis = {
      id: `manual-${Date.now()}`,
      motionDescription: "Manual Entry",
      gsdCode: "GP1E",
      startTime,
      endTime,
      duration: endTime - startTime,
      tmu: (endTime - startTime) * 27.8,
      confidenceScore: 100
    };
    
    if (insertAt !== undefined) {
      cycle.motions.splice(insertAt, 0, newMotion);
    } else {
      cycle.motions.push(newMotion);
    }
    
    // Recalculate cycle total TMU
    cycle.totalTmu = cycle.motions.reduce((sum, m) => sum + m.tmu, 0);
    
    // Recalculate overall average and total
    const validCycles = updatedResult.cycles.filter(c => c.motions.length > 0);
    if (validCycles.length > 0) {
      const avgTmu = validCycles.reduce((sum, c) => sum + c.totalTmu, 0) / validCycles.length;
      updatedResult.totalSmv = avgTmu * 0.0006 * 1.15;
      updatedResult.averageCycleTime = validCycles.reduce((sum, c) => sum + c.motions.reduce((s, m) => s + m.duration, 0), 0) / validCycles.length;
    } else {
      updatedResult.totalSmv = 0;
      updatedResult.averageCycleTime = 0;
    }
    
    updateResultWithHistory(updatedResult);
  };

  const handleReorderMotions = (cycleIndex: number, newMotions: MotionAnalysis[]) => {
    if (!result) return;
    
    const updatedResult = JSON.parse(JSON.stringify(result)) as AnalysisResult;
    updatedResult.cycles[cycleIndex].motions = newMotions;
    
    // Recalculate cycle total TMU
    updatedResult.cycles[cycleIndex].totalTmu = newMotions.reduce((sum, m) => sum + m.tmu, 0);
    
    // Recalculate overall average and total
    const validCycles3 = updatedResult.cycles.filter(c => c.motions.length > 0);
    if (validCycles3.length > 0) {
      const avgTmu = validCycles3.reduce((sum, c) => sum + c.totalTmu, 0) / validCycles3.length;
      updatedResult.totalSmv = avgTmu * 0.0006 * 1.15;
      updatedResult.averageCycleTime = validCycles3.reduce((sum, c) => sum + c.motions.reduce((s, m) => s + m.duration, 0), 0) / validCycles3.length;
    } else {
      updatedResult.totalSmv = 0;
      updatedResult.averageCycleTime = 0;
    }
    
    updateResultWithHistory(updatedResult);
  };

  const handleRemoveMotion = (cycleIndex: number, motionIndex: number) => {
    if (!result) return;
    
    const updatedResult = JSON.parse(JSON.stringify(result)) as AnalysisResult;
    updatedResult.cycles[cycleIndex].motions.splice(motionIndex, 1);
    
    // Recalculate cycle total TMU
    updatedResult.cycles[cycleIndex].totalTmu = updatedResult.cycles[cycleIndex].motions.reduce((sum, m) => sum + m.tmu, 0);
    
    // Recalculate overall average and total
    const validCycles2 = updatedResult.cycles.filter(c => c.motions.length > 0);
    if (validCycles2.length > 0) {
      const avgTmu = validCycles2.reduce((sum, c) => sum + c.totalTmu, 0) / validCycles2.length;
      updatedResult.totalSmv = avgTmu * 0.0006 * 1.15;
      updatedResult.averageCycleTime = validCycles2.reduce((sum, c) => sum + c.motions.reduce((s, m) => s + m.duration, 0), 0) / validCycles2.length;
    } else {
      updatedResult.totalSmv = 0;
      updatedResult.averageCycleTime = 0;
    }
    
    updateResultWithHistory(updatedResult);
  };

  const handleMoveMotionUp = (cycleIndex: number, motionIndex: number) => {
    if (!result || motionIndex === 0) return;
    const updatedResult = JSON.parse(JSON.stringify(result)) as AnalysisResult;
    const motions = updatedResult.cycles[cycleIndex].motions;
    const temp = motions[motionIndex];
    motions[motionIndex] = motions[motionIndex - 1];
    motions[motionIndex - 1] = temp;
    updateResultWithHistory(updatedResult);
  };

  const handleMoveMotionDown = (cycleIndex: number, motionIndex: number) => {
    if (!result || motionIndex === result.cycles[cycleIndex].motions.length - 1) return;
    const updatedResult = JSON.parse(JSON.stringify(result)) as AnalysisResult;
    const motions = updatedResult.cycles[cycleIndex].motions;
    const temp = motions[motionIndex];
    motions[motionIndex] = motions[motionIndex + 1];
    motions[motionIndex + 1] = temp;
    updateResultWithHistory(updatedResult);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      playerContainerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const filteredCodes = GSD_CODES.filter(c => 
    c.code.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.desc.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getGsdDescription = (code: string) => {
    return GSD_CODES.find(c => c.code === code)?.desc || 'Unknown Motion';
  };

  const downloadCSV = () => {
    if (!result) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Cycle,Motion Description,GSD Code,Standard Description,Start Time (s),End Time (s),Duration (s),TMU,SMV\n";

    let grandTotalDuration = 0;
    let grandTotalTmu = 0;

    result.cycles.forEach(cycle => {
      let cycleDuration = 0;
      let cycleTmu = 0;

      cycle.motions.forEach(motion => {
        cycleDuration += motion.duration;
        cycleTmu += motion.tmu;
        const baseSmv = (motion.tmu * 0.0006).toFixed(5);
        
        const row = [
          cycle.cycleNumber,
          `"${motion.motionDescription.replace(/"/g, '""')}"`,
          motion.gsdCode,
          `"${getGsdDescription(motion.gsdCode).replace(/"/g, '""')}"`,
          motion.startTime.toFixed(3),
          motion.endTime.toFixed(3),
          motion.duration.toFixed(3),
          motion.tmu.toFixed(1),
          baseSmv
        ].join(",");
        csvContent += row + "\n";
      });

      grandTotalDuration += cycleDuration;
      grandTotalTmu += cycleTmu;

      // Cycle summary row
      const cycleSmv = (cycleTmu * 0.0006).toFixed(5);
      csvContent += `,,,,,,${cycleDuration.toFixed(3)},${cycleTmu.toFixed(1)},${cycleSmv}\n`;
    });

    // Final summary row
    csvContent += `,,,,,,${grandTotalDuration.toFixed(3)},${grandTotalTmu.toFixed(2)},${result.totalSmv.toFixed(3)}\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    
    // Create custom filename based on Process Description and Style Number
    const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_{2,}/g, '_').replace(/^_|_$/g, '');
    const opStr = sanitize(operationName) || 'gsd_analysis';
    const styleStr = sanitize(styleNumber);
    const fileName = styleStr ? `${opStr}_${styleStr}.csv` : `${opStr}.csv`;
    
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportVideo = async () => {
    if (!videoRef.current || !result) return;
    
    const video = videoRef.current;
    const video2 = videoRef2.current;
    
    if (video.readyState < 2 || (video2 && video2.readyState < 2)) {
      alert("Please wait for videos to load before exporting.");
      return;
    }

    if (!('VideoEncoder' in window)) {
      alert("Your browser does not support the WebCodecs API required for high-quality export. Please use a recent version of Chrome or Edge.");
      return;
    }
    
    setIsExporting(true);
    setExportProgress(0);
    const originalTime = video.currentTime;
    const originalTime2 = video2 ? video2.currentTime : 0;
    
    const canvas = document.createElement('canvas');
    
    const MAX_WIDTH = 1280;
    const MAX_HEIGHT = 720;
    
    let exportWidth = video.videoWidth;
    let exportHeight = video.videoHeight;
    
    if (exportWidth > MAX_WIDTH || exportHeight > MAX_HEIGHT) {
      const ratio = Math.min(MAX_WIDTH / exportWidth, MAX_HEIGHT / exportHeight);
      exportWidth = Math.floor(exportWidth * ratio);
      exportHeight = Math.floor(exportHeight * ratio);
    }
    
    // Ensure dimensions are even (required by some encoders)
    exportWidth = exportWidth - (exportWidth % 2);
    exportHeight = exportHeight - (exportHeight % 2);
    
    canvas.width = exportWidth;
    canvas.height = exportHeight;
    
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      setIsExporting(false);
      return;
    }

    try {
      const muxer = new Mp4Muxer.Muxer({
        target: new Mp4Muxer.ArrayBufferTarget(),
        video: {
          codec: 'avc',
          width: exportWidth,
          height: exportHeight
        },
        fastStart: 'in-memory'
      });

      const videoEncoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: e => {
          console.error("VideoEncoder error:", e);
          setError("Video encoding failed.");
        }
      });

      videoEncoder.configure({
        codec: 'avc1.42001f', // Baseline profile
        width: exportWidth,
        height: exportHeight,
        bitrate: 4_000_000,
        framerate: 30
      });

      const fps = 30;
      const duration = video.duration;
      
      let videoTime = 0;
      let outputFrame = 0;
      
      const totalOutputFrames = Math.floor(duration * fps);

      video.pause();
      if (video2) video2.pause();

      const drawOverlays = (currentTime: number) => {
        const scale = Math.max(canvas.width / 1280, 1);
        
        ctx.save();
        
        // Top Center Text
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        
        ctx.font = `bold ${18 * scale}px sans-serif`;
        ctx.lineWidth = 4 * scale;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.strokeText(operationName, canvas.width / 2, 24 * scale);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(operationName, canvas.width / 2, 24 * scale);
        
        ctx.font = `bold ${14 * scale}px sans-serif`;
        ctx.lineWidth = 3 * scale;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.strokeText(styleNumber, canvas.width / 2, 48 * scale);
        ctx.fillStyle = '#FFFF00';
        ctx.fillText(styleNumber, canvas.width / 2, 48 * scale);
        
        // Top Right Text
        ctx.textAlign = 'right';
        ctx.font = `bold ${16 * scale}px sans-serif`;
        const gradeText = `SKILL GRADE : ${skillGrade}%`;
        const gradeMetrics = ctx.measureText(gradeText);
        const gradePaddingX = 10 * scale;
        const gradePaddingY = 6 * scale;
        const gradeBoxWidth = gradeMetrics.width + gradePaddingX * 2;
        const gradeBoxHeight = 16 * scale + gradePaddingY * 2;
        const gradeX = canvas.width - 24 * scale;
        let rightSideY = 24 * scale;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(gradeX - gradeMetrics.width - gradePaddingX, rightSideY, gradeBoxWidth, gradeBoxHeight);
        
        ctx.fillStyle = '#28A745';
        ctx.fillText(gradeText, gradeX, rightSideY + gradePaddingY);
        
        rightSideY += gradeBoxHeight + 8 * scale;
        
        // Cycle summaries
        ctx.font = `bold ${12 * scale}px monospace`;
        const cycleSummaries = result.cycles.filter(c => c.motions.length > 0 && currentTime >= c.motions[c.motions.length - 1].endTime).map(c => `Cycle ${c.cycleNumber} = ${c.motions.reduce((s, m) => s + m.duration, 0).toFixed(3)}s`);
        
        for (const sumText of cycleSummaries) {
          const sumMetrics = ctx.measureText(sumText);
          const sumPaddingX = 8 * scale;
          const sumPaddingY = 4 * scale;
          const sumBoxWidth = sumMetrics.width + sumPaddingX * 2;
          const sumBoxHeight = 12 * scale + sumPaddingY * 2;
          
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
          ctx.lineWidth = 1 * scale;
          
          const sumBoxX = gradeX - sumMetrics.width - sumPaddingX;
          
          ctx.fillRect(sumBoxX, rightSideY, sumBoxWidth, sumBoxHeight);
          ctx.strokeRect(sumBoxX, rightSideY, sumBoxWidth, sumBoxHeight);
          
          ctx.fillStyle = '#00FF00';
          ctx.fillText(sumText, gradeX, rightSideY + sumPaddingY);
          
          rightSideY += sumBoxHeight + 4 * scale;
        }

        ctx.restore();
        
        let currentCycle = null;
        for (const cycle of result.cycles) {
          if (cycle.motions.length > 0) {
            const cycleStart = cycle.motions[0].startTime;
            const cycleEnd = cycle.motions[cycle.motions.length - 1].endTime;
            if (currentTime >= cycleStart && currentTime <= cycleEnd) {
              currentCycle = cycle;
              break;
            }
          }
        }

        if (currentCycle) {
          const currentMotion = currentCycle.motions.find(m => currentTime >= m.startTime && currentTime < m.endTime);
          const activeMotionId = currentMotion ? currentMotion.id : null;
          
          const paddingX = 12 * scale;
          const paddingY = 6 * scale;
          const fontSize = 16 * scale;
          const startX = 24 * scale;
          let currentY = 24 * scale;

          ctx.font = `bold ${fontSize}px sans-serif`;
          const cycleText = `CYCLE ${currentCycle.cycleNumber}`;
          const cycleMetrics = ctx.measureText(cycleText);
          
          const min = Math.floor(currentTime / 60);
          const sec = Math.floor(currentTime % 60);
          const ms = Math.floor((currentTime % 1) * 1000);
          const timeText = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
          
          ctx.font = `bold ${fontSize}px monospace`;
          const timeMetrics = ctx.measureText(timeText);
          
          ctx.fillStyle = '#0066FF';
          ctx.fillRect(startX, currentY, cycleMetrics.width + paddingX * 2, fontSize + paddingY * 2);
          ctx.fillStyle = '#FFFFFF';
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.textBaseline = 'top';
          ctx.fillText(cycleText, startX + paddingX, currentY + paddingY);
          
          const timeStartX = startX + cycleMetrics.width + paddingX * 2 + 8 * scale;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
          ctx.fillRect(timeStartX, currentY, timeMetrics.width + paddingX * 2, fontSize + paddingY * 2);
          ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
          ctx.lineWidth = 1 * scale;
          ctx.strokeRect(timeStartX, currentY, timeMetrics.width + paddingX * 2, fontSize + paddingY * 2);
          ctx.fillStyle = '#00FF00';
          ctx.font = `bold ${fontSize}px monospace`;
          ctx.fillText(timeText, timeStartX + paddingX, currentY + paddingY);
          
          currentY += fontSize + paddingY * 2 + 10 * scale;

          for (const motion of currentCycle.motions) {
            if (currentTime < motion.startTime) continue;
            
            const isCurrent = motion.id === activeMotionId;
            const hasPassed = currentTime > motion.endTime;
            
            const text = `${motion.gsdCode} : ${motion.duration.toFixed(3)}S`;
            
            const motionFontSize = isCurrent ? fontSize * 1.2 : fontSize;
            ctx.font = `bold ${motionFontSize}px sans-serif`;
            const metrics = ctx.measureText(text);
            
            const boxWidth = metrics.width + paddingX * 2;
            const boxHeight = motionFontSize + paddingY * 2;
            
            if (isCurrent) {
              ctx.fillStyle = '#FFFF00';
              ctx.fillRect(startX, currentY, boxWidth, boxHeight);
              ctx.fillStyle = '#000000';
            } else if (hasPassed) {
              ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
              ctx.fillRect(startX, currentY, boxWidth, boxHeight);
              ctx.fillStyle = 'rgba(255, 255, 0, 0.6)';
            } else {
              ctx.fillStyle = '#000000';
              ctx.fillRect(startX, currentY, boxWidth, boxHeight);
              ctx.fillStyle = '#FFFF00';
            }
            
            ctx.fillText(text, startX + paddingX, currentY + paddingY);
            currentY += boxHeight + 8 * scale;
          }
        }
      };

      const processNextFrame = async () => {
        if (videoTime >= duration) {
          await videoEncoder.flush();
          muxer.finalize();
          
          const buffer = muxer.target.buffer;
          const blob = new Blob([buffer], { type: 'video/mp4' });
          const url = URL.createObjectURL(blob);
          
          const a = document.createElement('a');
          a.href = url;
          
          // Create custom filename based on Process Description and Style Number
          const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_{2,}/g, '_').replace(/^_|_$/g, '');
          const opStr = sanitize(operationName) || 'gsd_analysis';
          const styleStr = sanitize(styleNumber);
          const fileName = styleStr ? `${opStr}_${styleStr}.mp4` : `${opStr}.mp4`;
          
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          video.currentTime = originalTime;
          if (video2) video2.currentTime = originalTime2;
          setIsExporting(false);
          setExportProgress(0);
          return;
        }

        videoTime += 1 / fps;

        const currentTime = videoTime;
        
        // Seek video and wait for it to be ready
        await new Promise<void>((resolve) => {
          if (Math.abs(video.currentTime - currentTime) < 0.001) {
            resolve();
            return;
          }
          
          let timeoutId: any;
          const onSeeked = () => {
            clearTimeout(timeoutId);
            video.removeEventListener('seeked', onSeeked);
            resolve();
          };
          video.addEventListener('seeked', onSeeked);
          video.currentTime = currentTime;
          
          // Fallback timeout in case seeked never fires
          timeoutId = setTimeout(() => {
            video.removeEventListener('seeked', onSeeked);
            resolve();
          }, 1000);
        });

        if (video2) {
          await new Promise<void>((resolve) => {
            if (Math.abs(video2.currentTime - currentTime) < 0.001) {
              resolve();
              return;
            }
            
            let timeoutId: any;
            const onSeeked = () => {
              clearTimeout(timeoutId);
              video2.removeEventListener('seeked', onSeeked);
              resolve();
            };
            video2.addEventListener('seeked', onSeeked);
            video2.currentTime = currentTime;
            
            timeoutId = setTimeout(() => {
              video2.removeEventListener('seeked', onSeeked);
              resolve();
            }, 1000);
          });
        }

        // Draw frame
        ctx.drawImage(video, 0, 0, exportWidth, exportHeight);
        drawOverlays(currentTime);

        // Create VideoFrame and encode
        const frame = new VideoFrame(canvas, {
          timestamp: (outputFrame * 1000000) / fps, // in microseconds
          duration: 1000000 / fps
        });
        
        const keyFrame = outputFrame % 30 === 0;
        videoEncoder.encode(frame, { keyFrame });
        frame.close();

        outputFrame++;
        setExportProgress((outputFrame / totalOutputFrames) * 100);

        // Yield to main thread to update UI and prevent freezing
        setTimeout(processNextFrame, 0);
      };

      // Start processing
      processNextFrame();

    } catch (err) {
      console.error("Export error:", err);
      setError("Failed to export video.");
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('video/')) {
        setError('Please upload a valid video file.');
        return;
      }
      cancelAnalysis();
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
      setResult(null);
      setError(null);
    }
  };

  const cancelAnalysis = () => {
    if (analysisAbortControllerRef.current) {
      analysisAbortControllerRef.current.abort();
      analysisAbortControllerRef.current = null;
      setIsAnalyzing(false);
      setAnalysisStatus('');
    }
  };

  const handleClearVideos = () => {
    cancelAnalysis();
    setVideoFile(null);
    setVideoUrl(null);
    setResult(null);
    setError(null);
    setVideoDuration(0);
  };

  const handleNewAnalysis = () => {
    cancelAnalysis();
    setVideoFile(null);
    setVideoUrl(null);
    setResult(null);
    setError(null);
    setVideoDuration(0);
    setOperationName('');
    setStyleNumber('');
    setSkillGrade(80);
    window.history.pushState({}, '', window.location.pathname);
  };

  const handleAnalyze = async () => {
    if (!videoFile) return;

    setIsAnalyzing(true);
    setAnalysisStatus('Starting analysis...');
    setUploadProgress(undefined);
    setError(null);

    // Set up cancellation token
    analysisAbortControllerRef.current = new AbortController();

    try {
      const filesToAnalyze = [videoFile];

      const cacheKey = (await getCacheKey()) || undefined;
      
      const analysisResult = await analyzeOperationVideo(
        filesToAnalyze, 
        operationName || "industrial operation",
        expectedCycles, 
        cacheKey,
        (status, progress) => {
          setAnalysisStatus(status);
          setUploadProgress(progress);
        },
        analysisAbortControllerRef.current.signal
      );
      setResult(analysisResult);
      if (analysisResult.cycles.length > 0) {
        setExpandedCycle(0);
      }
    } catch (err) {
      if (err instanceof Error && err.message === "Analysis cancelled") {
        console.log("Analysis was cancelled by the user.");
        return; // Don't set error state if it was intentionally cancelled
      }
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to analyze video. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleCycle = (index: number) => {
    setExpandedCycle(expandedCycle === index ? null : index);
  };

  useEffect(() => {
    let animationFrameId: number;
    
    // Removed isExporting block to allow background status tracking while using the system
    
    const updateTime = () => {
      if (!videoRef.current || !result) return;
      const currentTime = videoRef.current.currentTime;
      const timeDelta = currentTime - lastTimeRef.current;
      const isPlayingNormally = timeDelta > 0 && timeDelta < 0.5;
      lastTimeRef.current = currentTime;
      
      let currentCycle = null;
      let activeMotions: MotionAnalysis[] = [];
      
      for (const cycle of result.cycles) {
        if (cycle.motions.length > 0) {
          const cycleStart = cycle.motions[0].startTime;
          const cycleEnd = cycle.motions[cycle.motions.length - 1].endTime;
          
          if (currentTime >= cycleStart && currentTime <= cycleEnd) {
            currentCycle = cycle;
            break;
          }
        }
      }

      if (currentCycle) {
        const currentMotionIndex = currentCycle.motions.findIndex(m => currentTime >= m.startTime && currentTime < m.endTime);
        const currentMotionId = currentMotionIndex !== -1 ? currentCycle.motions[currentMotionIndex].id : null;
        setActiveMotionId(currentMotionId);

        // Update stopwatch display
        const stopwatchEl = document.getElementById('stopwatch-display');
        if (stopwatchEl) {
          const min = Math.floor(currentTime / 60);
          const sec = Math.floor(currentTime % 60);
          const ms = Math.floor((currentTime % 1) * 1000);
          stopwatchEl.textContent = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
        }

        // Only show motions that have already started
        const pastMotions = currentCycle.motions.filter(m => currentTime >= m.startTime);
        
        // Pagination: If the list gets too long (e.g., > 18 items), clear it and start fresh for the next batch
        const MAX_ITEMS = 18;
        if (pastMotions.length > 0) {
          const latestIndex = pastMotions.length - 1;
          const chunkStartIndex = Math.floor(latestIndex / MAX_ITEMS) * MAX_ITEMS;
          activeMotions = pastMotions.slice(chunkStartIndex);
        } else {
          activeMotions = [];
        }

        setActiveCycleNumber(currentCycle.cycleNumber);
        
        if (currentMotionId) {
          lastMotionIdRef.current = currentMotionId;
        }
      } else {
        setActiveCycleNumber(null);
        setActiveMotionId(null);
        
        lastMotionIdRef.current = null;
      }
      
      setActiveMotionsOverlay(prev => {
        if (prev.length === activeMotions.length && prev.every((m, i) => m.id === activeMotions[i].id)) {
          return prev;
        }
        return activeMotions;
      });
    };

    const loop = () => {
      updateTime();
      animationFrameId = requestAnimationFrame(loop);
    };

    const video = videoRef.current;
    if (video) {
      const onPlay = (e: Event) => {
        animationFrameId = requestAnimationFrame(loop);
      };
      const onPause = (e: Event) => {
        cancelAnimationFrame(animationFrameId);
        updateTime();
      };
      const onSeeked = () => {
        lastTimeRef.current = videoRef.current?.currentTime || 0;
        updateTime();
      };
      const onSeeking = () => {
        if (video.paused) {
          updateTime();
        }
      };
      const onTimeUpdate = () => {
        if (video.paused) {
          updateTime();
        }
      };
      
      video.addEventListener('play', onPlay);
      video.addEventListener('pause', onPause);
      video.addEventListener('seeked', onSeeked);
      video.addEventListener('seeking', onSeeking);
      video.addEventListener('timeupdate', onTimeUpdate);
      
      if (!video.paused) {
        animationFrameId = requestAnimationFrame(loop);
      }
      
      return () => {
        video.removeEventListener('play', onPlay);
        video.removeEventListener('pause', onPause);
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('seeking', onSeeking);
        video.removeEventListener('timeupdate', onTimeUpdate);
        cancelAnimationFrame(animationFrameId);
      };
    }
  }, [result, isExporting]);

  const handleManualMotionSelect = (id: string | null) => {
    setActiveMotionId(id);
  };

  const playSingleMotion = (motion: MotionAnalysis) => {
    if (videoRef.current) {
      videoRef.current.currentTime = motion.startTime;
      videoRef.current.play().catch(e => console.error("Playback failed", e));
    }
  };

  const playCycle = (e: React.MouseEvent, cycle: Cycle) => {
    e.stopPropagation();
    if (cycle.motions.length === 0) return;
    if (videoRef.current) {
      videoRef.current.currentTime = cycle.motions[0].startTime;
      videoRef.current.play().catch(e => console.error("Playback failed", e));
    }
  };

  const playAll = () => {
    if (!result) return;
    const allMotions = result.cycles.flatMap(c => c.motions);
    if (allMotions.length === 0) return;
    if (videoRef.current) {
      videoRef.current.currentTime = allMotions[0].startTime;
      videoRef.current.play().catch(e => console.error("Playback failed", e));
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans">
      {!hasValidApiKey && (
        <div className="bg-[#FFE5B4] border-b border-[#FFDAB9] px-6 py-3 flex items-center justify-between z-50">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-[#D97706]" />
            <span className="text-[#92400E] font-medium">To run AI analysis, please configure your Gemini API Key.</span>
          </div>
          <button 
            onClick={handleSelectApiKey}
            className="bg-[#D97706] hover:bg-[#B45309] text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
          >
            Configure API Key
          </button>
        </div>
      )}
      {/* Header */}
      <header className="bg-white border-b border-[#E9ECEF] px-6 py-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 200 100" className="h-10 w-auto flex-shrink-0 relative -left-2" fill="none" xmlns="http://www.w3.org/2000/svg">
              <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize="100" fontFamily="sans-serif" fontWeight="bold" fill="#6A808C" fontStyle="italic">UBI</text>
            </svg>
            <h1 className="text-xl font-bold tracking-tight shrink-0 mr-4">GSD Motion Analyzer</h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-[#6C757D]">
            <button 
              onClick={() => setShowReference(!showReference)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${showReference ? 'bg-[#F0F7FF] text-[#0066FF]' : 'hover:bg-[#F8F9FA]'}`}
            >
              <BookOpen className="w-4 h-4" />
              <span>GSD Reference</span>
            </button>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#28A745]" />
              <span>AI Analysis Ready</span>
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {showReference && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-white border-b border-[#E9ECEF] overflow-hidden"
          >
            <div className="max-w-7xl mx-auto p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-[#0066FF]" />
                  GSD Code Reference
                </h3>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#ADB5BD]" />
                  <input 
                    type="text" 
                    placeholder="Search codes or descriptions..." 
                    className="pl-9 pr-4 py-2 bg-[#F8F9FA] border border-[#E9ECEF] rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#0066FF]/20 w-64"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-2 max-h-[300px] overflow-y-auto pr-4 custom-scrollbar">
                {filteredCodes.map((c) => (
                  <div key={c.code} className="flex items-center gap-3 py-1 text-sm group">
                    <span className="font-mono font-bold text-[#0066FF] bg-[#F0F7FF] px-1.5 py-0.5 rounded min-w-[50px] text-center">
                      {c.code}
                    </span>
                    <span className="text-[#495057] group-hover:text-[#1A1A1A] transition-colors truncate">
                      {c.desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-[1600px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Video & Controls */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-[88px] lg:h-[calc(100vh-88px)] lg:overflow-y-auto no-scrollbar z-30 lg:self-start">
          <section className="bg-white rounded-2xl border border-[#E9ECEF] overflow-hidden shadow-sm flex-shrink-0">
            <div className="p-4 border-b border-[#E9ECEF] flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <FileVideo className="w-4 h-4 text-[#0066FF]" />
                Operation Video
              </h2>
              <div className="flex items-center gap-2">
                {videoFile && (
                  <>
                    <span className="text-xs text-[#6C757D] bg-[#F8F9FA] px-2 py-1 rounded-md">
                      {(videoFile.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                    <button 
                      onClick={handleClearVideos}
                      className="text-xs text-[#C53030] hover:text-[#9B2C2C] bg-[#FFF5F5] hover:bg-[#FFE3E3] px-2 py-1 rounded-md cursor-pointer transition-colors font-medium ml-1"
                      title="Remove Video"
                    >
                      <X className="w-3 h-3 inline-block mr-1" />
                      Remove
                    </button>
                  </>
                )}
              </div>
            </div>

            <div ref={playerContainerRef} className="@container aspect-video bg-black relative flex items-center justify-center group overflow-hidden">
              {videoUrl ? (
                <>
                  <div className="relative h-full w-full">
                    <video 
                      ref={videoRef}
                      src={videoUrl} 
                      className="w-full h-full object-contain"
                      controls
                      controlsList="nofullscreen"
                      onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration)}
                    />
                  </div>
                  
                  {/* Custom Fullscreen Button */}
                  <button 
                    onClick={toggleFullscreen}
                    className="absolute bottom-4 right-4 z-50 bg-black/50 p-2 rounded text-white hover:bg-black/80 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="Fullscreen"
                  >
                    <Maximize className="w-5 h-5" />
                  </button>
                  
                  {/* Static Overlays */}
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center z-10 pointer-events-none">
                    <div className="text-white font-bold text-[clamp(10px,2.5cqw,24px)] tracking-wider drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                      {operationName}
                    </div>
                    <div className="text-[#FFFF00] font-semibold text-[clamp(8px,2cqw,16px)] drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] mt-0.5">
                      {styleNumber}
                    </div>
                  </div>
                  
                  <div className="absolute top-4 right-4 z-10 pointer-events-none flex flex-col items-end gap-2">
                    <div className="bg-black/60 text-[#28A745] font-bold px-[clamp(4px,1cqw,12px)] py-[clamp(2px,0.5cqw,6px)] rounded border border-[#28A745]/30 shadow-sm text-[clamp(8px,1.8cqw,16px)]">
                      SKILL GRADE : {skillGrade}%
                    </div>
                    {result && result.cycles.filter(c => c.motions.length > 0 && (!videoRef.current || videoRef.current.currentTime >= c.motions[c.motions.length - 1].endTime)).map(c => (
                      <div key={c.cycleNumber} className="bg-black/60 text-[#00FF00] font-mono font-bold px-[clamp(4px,1cqw,12px)] py-[clamp(2px,0.5cqw,6px)] text-[clamp(8px,1.4cqw,12px)] rounded border border-[#00FF00]/30 shadow-sm whitespace-nowrap">
                        Cycle {c.cycleNumber} = {c.motions.reduce((s, m) => s + m.duration, 0).toFixed(3)}s
                      </div>
                    ))}
                  </div>
                  
                  {/* Custom Video Controls */}
                  <div className="absolute bottom-[20%] left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1.5 justify-center rounded-3xl border border-white/20 z-20 transition-opacity opacity-0 group-hover:opacity-100">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (videoRef.current) {
                          videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 0.1);
                        }
                      }}
                      className="p-1 text-white hover:text-[#0066FF] hover:bg-white/10 rounded-full transition-colors"
                      title="Step Backward 0.1s (Left Arrow)"
                    >
                      <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (videoRef.current) {
                          if (videoRef.current.paused) videoRef.current.play();
                          else videoRef.current.pause();
                        }
                      }}
                      className="p-1 text-white hover:text-[#0066FF] hover:bg-white/10 rounded-full transition-colors"
                      title="Play/Pause (Spacebar)"
                    >
                      <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>

                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (videoRef.current) {
                          videoRef.current.currentTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + 0.1);
                        }
                      }}
                      className="p-1 text-white hover:text-[#0066FF] hover:bg-white/10 rounded-full transition-colors"
                      title="Step Forward 0.1s (Right Arrow)"
                    >
                      <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </div>

                  {/* Exporting Non-Blocking Toast */}
                  <AnimatePresence>
                    {isExporting && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="fixed bottom-6 right-6 w-80 bg-white/95 backdrop-blur-md border border-[#E9ECEF] rounded-2xl shadow-2xl p-4 z-[9999] flex flex-col gap-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 border-3 border-[#0066FF]/20 border-t-[#0066FF] rounded-full animate-spin"></div>
                            <h3 className="font-bold text-sm text-[#1A1A1A]">Exporting Video...</h3>
                          </div>
                          <span className="font-mono text-sm font-bold text-[#0066FF]">{Math.round(exportProgress)}%</span>
                        </div>
                        <div className="w-full h-2 bg-[#E9ECEF] rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-[#0066FF]"
                            initial={{ width: 0 }}
                            animate={{ width: `${exportProgress}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                        <p className="text-[10px] text-[#6C757D]">The system is processing your video in the background. You can continue working.</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {activeMotionsOverlay.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-4 left-4 flex flex-col gap-y-[clamp(2px,0.5cqw,4px)] z-20 overflow-y-auto max-h-[90%] no-scrollbar pr-4 pointer-events-auto"
                      >
                        {activeCycleNumber && (
                          <div className="flex gap-2 mb-1 pointer-events-none items-stretch">
                            <div className="bg-[#0066FF] text-white font-bold px-[clamp(6px,1.5cqw,16px)] py-[clamp(2px,0.5cqw,8px)] text-[clamp(8px,1.8cqw,16px)] leading-tight uppercase tracking-wider shadow-sm w-fit flex items-center">
                              CYCLE {activeCycleNumber}
                            </div>
                            <div id="stopwatch-display" className="bg-black/80 text-[#00FF00] font-mono font-bold px-[clamp(6px,1.5cqw,16px)] py-[clamp(2px,0.5cqw,8px)] text-[clamp(8px,1.8cqw,16px)] leading-tight tracking-wider shadow-sm flex items-center border border-[#00FF00]/30 min-w-[90px] justify-center">
                              00:00.000
                            </div>
                          </div>
                        )}
                        {activeMotionsOverlay.map((motion) => {
                          const isCurrent = motion.id === activeMotionId;
                          const hasPassed = (videoRef.current?.currentTime || 0) > motion.endTime;
                          return (
                            <button 
                              key={motion.id} 
                              onClick={() => playSingleMotion(motion)}
                              className={`font-bold px-[clamp(6px,1.5cqw,16px)] py-[clamp(2px,0.5cqw,8px)] text-[clamp(8px,1.5cqw,14px)] leading-tight uppercase tracking-wider shadow-sm w-fit transition-all duration-200 text-left ${
                                isCurrent 
                                  ? 'bg-[#FFFF00] text-black scale-105 origin-left z-20 shadow-md ring-2 ring-black/20' 
                                  : hasPassed
                                    ? 'bg-black/60 text-[#FFFF00]/60 hover:bg-black/80 hover:text-[#FFFF00]/80'
                                    : 'bg-black text-[#FFFF00] hover:bg-black/80'
                              }`}
                            >
                              {motion.gsdCode} : {motion.duration.toFixed(3)}S
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              ) : (
                <div className="text-center p-8">
                  <div className="w-16 h-16 bg-[#F8F9FA] rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-[#DEE2E6] group-hover:border-[#0066FF] transition-colors">
                    <Upload className="w-8 h-8 text-[#ADB5BD] group-hover:text-[#0066FF]" />
                  </div>
                  {result ? (
                    <>
                      <p className="text-[#6C757D] font-medium mb-1">Analysis loaded successfully!</p>
                      <p className="text-[#6C757D] text-sm mb-4">Upload the original video(s) to view playback and export.</p>
                    </>
                  ) : (
                    <p className="text-[#6C757D] text-sm mb-4">Upload a video of the operation (3-5 cycles)</p>
                  )}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <label className="bg-[#0066FF] hover:bg-[#0052CC] text-white px-6 py-2 rounded-full text-sm font-medium cursor-pointer transition-colors inline-block">
                      Select Video Local
                      <input type="file" className="hidden" accept=".mp4,.mov,.avi,.webm,video/mp4,video/quicktime,video/x-msvideo,video/webm" onChange={handleFileChange} />
                    </label>
                    <DrivePickerButton onFileSelect={(file) => {
                      cancelAnalysis();
                      setVideoFile(file);
                      setVideoUrl(URL.createObjectURL(file));
                      setResult(null);
                      setError(null);
                      setAnalysisStatus('');
                      setUploadProgress(undefined);
                      setExpandedCycle(0);
                    }} />
                  </div>
                  {!videoFile && (
                    <p className="text-xs text-[#6C757D] mt-4 max-w-sm mx-auto">
                      <span className="font-semibold">Tip:</span> For faster uploads and analysis, compress large 1080p/60fps videos to 720p/30fps before uploading.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Visual Timeline */}
            {result && videoDuration > 0 && (
              <div className="px-4 pb-4">
                <div className="w-full h-8 bg-[#E9ECEF] rounded-lg relative overflow-hidden flex shadow-inner">
                  {result.cycles.map((cycle, cIdx) => 
                    cycle.motions.map((motion, mIdx) => {
                      const left = (motion.startTime / videoDuration) * 100;
                      const width = (motion.duration / videoDuration) * 100;
                      const colors = ['bg-[#0066FF]', 'bg-[#20C997]', 'bg-[#6F42C1]', 'bg-[#FD7E14]', 'bg-[#E83E8C]'];
                      const color = colors[mIdx % colors.length];
                      return (
                        <div 
                          key={motion.id}
                          className={`absolute h-full ${color} opacity-80 hover:opacity-100 cursor-pointer border-r border-white/30 transition-opacity`}
                          style={{ left: `${left}%`, width: `${width}%` }}
                          title={`Cycle ${cycle.cycleNumber} - ${motion.gsdCode}: ${motion.motionDescription}`}
                          onClick={() => {
                            if (videoRef.current) {
                              videoRef.current.currentTime = motion.startTime;
                              videoRef.current.play();
                            }
                          }}
                        />
                      )
                    })
                  )}
                </div>
                <div className="flex justify-between text-xs text-[#6C757D] mt-1 px-1 font-mono">
                  <span>0:00</span>
                  <span>{Math.floor(videoDuration / 60)}:{(videoDuration % 60).toFixed(1).padStart(4, '0')}</span>
                </div>
              </div>
            )}

            {videoFile && !result && !isAnalyzing && (
              <div className="p-4 bg-[#F0F7FF] border-t border-[#E9ECEF] flex flex-col gap-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Process Description</label>
                    <textarea 
                      value={operationName} 
                      onChange={(e) => setOperationName(e.target.value)}
                      placeholder="e.g., SLEEVE HEM"
                      rows={1}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0066FF]/50 resize-none h-10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Style # / Brand Name</label>
                    <input 
                      type="text"
                      value={styleNumber} 
                      onChange={(e) => setStyleNumber(e.target.value)}
                      placeholder="e.g., STY-4592"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0066FF]/50 h-10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Skill Grade (%)</label>
                    <div className="relative">
                      <input 
                        type="number"
                        min="1"
                        max="100"
                        value={skillGrade} 
                        onChange={(e) => setSkillGrade(Math.min(100, Math.max(1, parseInt(e.target.value) || 0)))}
                        placeholder="80"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0066FF]/50 h-10 pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expected Cycles</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        min="1" 
                        max="100" 
                        value={expectedCycles}
                        onChange={(e) => setExpectedCycles(Math.max(1, Math.min(100, parseInt(e.target.value) || 3)))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0066FF]/50 h-10 text-center"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-3 mt-1">
                  <div className="flex gap-3">
                    <button 
                      onClick={handleClearVideos}
                      className="flex-1 bg-white border border-[#DEE2E6] hover:bg-[#F8F9FA] text-[#495057] py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
                    >
                      <X className="w-5 h-5" />
                      Cancel
                    </button>
                    <button 
                      onClick={handleAnalyze}
                      disabled={!operationName}
                      className="flex-[2] bg-[#0066FF] hover:bg-[#0052CC] text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Activity className="w-5 h-5" />
                      Start AI GSD Analysis
                    </button>
                  </div>
                </div>
              </div>
            )}
                  


            {isAnalyzing && (
              <div className="p-8 text-center space-y-4">
                <div className="relative w-12 h-12 mx-auto">
                  <div className="absolute inset-0 border-4 border-[#E9ECEF] rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-[#0066FF] border-t-transparent rounded-full animate-spin"></div>
                </div>
                <div>
                  <p className="font-semibold">{analysisStatus || 'Analyzing Motion Cycles...'}</p>
                  {uploadProgress !== undefined ? (
                    <div className="w-64 mx-auto mt-3">
                      <div className="h-2 bg-[#E9ECEF] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#0066FF] transition-all duration-300 ease-out"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-xs text-[#6C757D] mt-1">{uploadProgress}%</p>
                    </div>
                  ) : (
                    <p className="text-sm text-[#6C757D]">Gemini AI is identifying GSD codes and timing</p>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 bg-[#FFF5F5] border-t border-[#FFE3E3] flex items-start gap-3 text-[#C53030]">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
              </div>
            )}
          </section>

          {/* Quick Stats */}
          {result && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-[#E9ECEF] shadow-sm">
                  <div className="flex items-center gap-2 text-[#6C757D] text-xs font-medium uppercase tracking-wider mb-2">
                    <Timer className="w-3.5 h-3.5" />
                    Avg Cycle Time
                  </div>
                  <div className="text-2xl font-bold text-[#0066FF]">
                    {result.averageCycleTime.toFixed(3)}s
                  </div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-[#E9ECEF] shadow-sm">
                  <div className="flex items-center gap-2 text-[#6C757D] text-xs font-medium uppercase tracking-wider mb-2">
                    <BarChart3 className="w-3.5 h-3.5" />
                    Total SMV
                  </div>
                  <div className="text-2xl font-bold text-[#28A745]">
                    {result.totalSmv.toFixed(3)}
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-2xl border border-[#E9ECEF] shadow-sm">
                <div className="flex items-center gap-2 text-[#6C757D] text-xs font-medium uppercase tracking-wider mb-3">
                  <Clock className="w-3.5 h-3.5" />
                  Cycle Durations
                </div>
                <div className="space-y-2">
                  {result.cycles.map((cycle) => {
                    const durationInSeconds = cycle.motions.reduce((sum, m) => sum + m.duration, 0);
                    return (
                      <div key={cycle.cycleNumber} className="flex justify-between items-center text-sm">
                        <span className="font-medium text-[#495057]">Cycle {cycle.cycleNumber}</span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-[#6C757D] text-xs">{(durationInSeconds / 60).toFixed(2)}m</span>
                          <span className="text-[#0066FF] bg-[#F0F7FF] px-2 py-0.5 rounded">
                            {durationInSeconds.toFixed(3)}s
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-7">
          {!result && !isAnalyzing ? (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white rounded-2xl border border-[#E9ECEF] border-dashed text-center p-12">
              <div className="w-20 h-20 bg-[#F8F9FA] rounded-full flex items-center justify-center mb-6">
                <svg viewBox="0 0 200 100" className="h-10 w-full opacity-50 grayscale mix-blend-multiply" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize="85" fontFamily="sans-serif" fontWeight="bold" fill="#6A808C" fontStyle="italic">UBI</text>
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">No Analysis Results</h3>
              <p className="text-[#6C757D] max-w-xs">
                Upload a video and start the analysis to see motion breakdowns and GSD codes.
              </p>
            </div>
          ) : result ? (
            <div id="analysis-report" className="space-y-4 relative">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 sticky top-[73px] z-40 bg-[#F8F9FA] py-3 lg:-mx-2 lg:px-2 border-b border-[#F8F9FA]">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold">Analysis Results</h2>
                  <button 
                    onClick={() => {
                      setTempOperationName(operationName);
                      setTempStyleNumber(styleNumber);
                      setTempSkillGrade(skillGrade);
                      setIsEditingInfo(true);
                    }}
                    className="p-1 text-[#6C757D] hover:text-[#0066FF] hover:bg-[#F0F7FF] rounded transition-colors"
                    title="Edit Video Info"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleUndo}
                    disabled={history.length === 0}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#6C757D] hover:bg-[#495057] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-30"
                    title="Undo last edit (Ctrl+Z)"
                  >
                    <Undo2 className="w-4 h-4" />
                    Undo
                  </button>
                  <button 
                    onClick={playAll}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#0066FF] hover:bg-[#0052CC] text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Play All
                  </button>
                  <button 
                    onClick={downloadCSV}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#0066FF] hover:bg-[#0052CC] text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </button>
                  <button 
                    onClick={exportVideo}
                    disabled={isExporting}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#0066FF] hover:bg-[#0052CC] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {isExporting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        {Math.round(exportProgress)}%
                      </>
                    ) : (
                      <>
                        <Film className="w-4 h-4" />
                        Export Video
                      </>
                    )}
                  </button>
                  <span className="text-sm text-[#6C757D]">{result.cycles.length} Cycles Detected</span>
                </div>
              </div>

              {result.cycles.map((cycle, idx) => (
                <div key={idx} className="bg-white rounded-2xl border border-[#E9ECEF] shadow-sm overflow-hidden">
                  <div 
                    onClick={() => toggleCycle(idx)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#F8F9FA] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-[#F0F7FF] text-[#0066FF] rounded-full flex items-center justify-center font-bold">
                        {cycle.cycleNumber}
                      </div>
                      <div className="text-left">
                        <div className="font-bold">Cycle {cycle.cycleNumber}</div>
                        <div className="text-xs text-[#6C757D]">{cycle.motions.length} motions • {cycle.totalTmu.toFixed(1)} TMU</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={(e) => playCycle(e, cycle)}
                        className="p-2 text-[#0066FF] hover:bg-[#F0F7FF] rounded-lg transition-colors"
                        title="Play entire cycle"
                      >
                        <Play className="w-4 h-4 fill-current" />
                      </button>
                      {expandedCycle === idx ? <ChevronDown className="w-5 h-5 text-[#6C757D]" /> : <ChevronRight className="w-5 h-5 text-[#6C757D]" />}
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedCycle === idx && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-[#E9ECEF]"
                      >
                        <div className="overflow-x-auto">
                          <TimelineEditor 
                            cycle={cycle}
                            cycleIndex={idx}
                            videoDuration={videoDuration}
                            videoRef={videoRef}
                            onUpdateResult={updateResultWithHistory}
                            result={result}
                            activeMotionId={activeMotionId}
                            onSelectMotion={handleManualMotionSelect}
                          />
                          <table className="w-full text-sm text-left">
                            <thead className="bg-[#F8F9FA] text-[#6C757D] font-medium border-b border-[#E9ECEF]">
                              <tr>
                                <th className="px-6 py-3">Motion Breakdown</th>
                                <th className="px-4 py-3">GSD Code</th>
                                <th className="px-4 py-3">Start - End Time (s)</th>
                                <th className="px-4 py-3">Duration</th>
                                <th className="px-4 py-3 text-right">TMU</th>
                                <th className="px-4 py-3 text-center">Edit Code</th>
                                <th className="px-6 py-3"></th>
                              </tr>
                            </thead>
                            <Reorder.Group axis="y" values={cycle.motions} onReorder={(newOrder) => handleReorderMotions(idx, newOrder)} as="tbody" className="divide-y divide-[#E9ECEF]">
                              {cycle.motions.map((motion, motionIdx) => {
                                const isActive = activeMotionId === motion.id;
                                return (
                                <Reorder.Item 
                                  key={motion.id} 
                                  value={motion}
                                  as="tr" 
                                  className={`${isActive ? 'bg-[#E6F0FF]' : 'hover:bg-[#F8F9FA]'} group transition-colors cursor-default`}
                                >
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                      <div className="cursor-grab active:cursor-grabbing text-[#CED4DA] hover:text-[#ADB5BD] transition-colors p-1 motion-safe:touch-none">
                                        <GripVertical className="w-4 h-4" />
                                      </div>
                                      <div 
                                        className="cursor-pointer"
                                        onClick={() => playSingleMotion(motion)}
                                      >
                                        <div className="font-medium flex items-center gap-2">
                                          {motion.motionDescription}
                                          {motion.confidenceScore !== undefined && motion.confidenceScore < 70 && (
                                            <span className="inline-flex items-center gap-1 text-xs bg-[#FFF3CD] text-[#856404] px-1.5 py-0.5 rounded-md font-medium" title={`Low AI Confidence: ${motion.confidenceScore}%`}>
                                              <AlertCircle className="w-3 h-3" />
                                              {motion.confidenceScore}%
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-xs text-[#6C757D] mt-0.5">{getGsdDescription(motion.gsdCode)}</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-4">
                                    <span className="bg-[#E9ECEF] px-2 py-1 rounded text-xs font-mono font-bold">
                                      {motion.gsdCode}
                                    </span>
                                  </td>
                                  <td className="px-4 py-4">
                                    <div className="flex items-center gap-1">
                                      <input 
                                        type="number" 
                                        step="0.001"
                                        min="0"
                                        className="w-16 text-xs border border-[#DEE2E6] rounded px-1.5 py-1 bg-white text-[#495057] focus:outline-none focus:border-[#0066FF] focus:ring-1 focus:ring-[#0066FF]"
                                        value={motion.startTime.toFixed(3)}
                                        onChange={(e) => handleUpdateMotionTime(idx, motionIdx, 'startTime', e.target.value)}
                                      />
                                      <span className="text-[#6C757D]">-</span>
                                      <input 
                                        type="number" 
                                        step="0.001"
                                        min="0"
                                        className="w-16 text-xs border border-[#DEE2E6] rounded px-1.5 py-1 bg-white text-[#495057] focus:outline-none focus:border-[#0066FF] focus:ring-1 focus:ring-[#0066FF]"
                                        value={motion.endTime.toFixed(3)}
                                        onChange={(e) => handleUpdateMotionTime(idx, motionIdx, 'endTime', e.target.value)}
                                      />
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 text-[#6C757D]">
                                    {motion.duration.toFixed(3)}s
                                  </td>
                                  <td className="px-4 py-4 text-right font-mono font-medium">
                                    {motion.tmu.toFixed(1)}
                                  </td>
                                  <td className="px-4 py-4 text-center">
                                    <select 
                                      className="text-xs border border-[#DEE2E6] rounded px-2 py-1.5 bg-white text-[#495057] focus:outline-none focus:border-[#0066FF] focus:ring-1 focus:ring-[#0066FF] w-24 cursor-pointer"
                                      value={motion.gsdCode}
                                      onChange={(e) => handleUpdateMotionCode(idx, motionIdx, e.target.value)}
                                    >
                                      {GSD_CODES.map(code => (
                                        <option key={code.code} value={code.code} title={code.desc}>
                                          {code.code}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <button 
                                        onClick={() => handleAddMotion(idx, motionIdx + 1)}
                                        className="p-2 text-[#28A745] hover:bg-[#E6F4EA] rounded-lg transition-all"
                                        title="Insert Motion Below"
                                      >
                                        <Plus className="w-4 h-4" />
                                      </button>
                                      <button 
                                        onClick={() => playSingleMotion(motion)}
                                        className={`p-2 text-[#0066FF] ${isActive ? 'opacity-100 bg-[#D0E2FF]' : 'opacity-0 group-hover:opacity-100 hover:bg-[#F0F7FF]'} rounded-lg transition-all`}
                                        title="Play this motion"
                                      >
                                        <Play className="w-4 h-4 fill-current" />
                                      </button>
                                      <button 
                                        onClick={() => handleRemoveMotion(idx, motionIdx)}
                                        className="p-2 text-[#DC3545] opacity-0 group-hover:opacity-100 hover:bg-[#FFF5F5] rounded-lg transition-all"
                                        title="Remove Motion"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </Reorder.Item>
                                );
                              })}
                            </Reorder.Group>
                          </table>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto p-6 mt-12 border-t border-[#E9ECEF] text-center text-[#ADB5BD] text-sm">
        <p>© 2026 GSD Motion Analyzer • Powered by Google Gemini AI</p>
      </footer>

      {/* Edit Info Modal */}
      <AnimatePresence>
        {isEditingInfo && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-[#E9ECEF] flex items-center justify-between">
                <h3 className="font-bold text-lg">Edit Video Information</h3>
                <button 
                  onClick={() => setIsEditingInfo(false)}
                  className="p-1 text-[#6C757D] hover:text-[#1A1A1A] rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#495057] mb-1">Operation Name</label>
                  <input 
                    type="text" 
                    value={tempOperationName}
                    onChange={(e) => setTempOperationName(e.target.value)}
                    className="w-full px-3 py-2 border border-[#DEE2E6] rounded-lg focus:outline-none focus:border-[#0066FF] focus:ring-1 focus:ring-[#0066FF]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#495057] mb-1">Style Number / Brand</label>
                  <input 
                    type="text" 
                    value={tempStyleNumber}
                    onChange={(e) => setTempStyleNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-[#DEE2E6] rounded-lg focus:outline-none focus:border-[#0066FF] focus:ring-1 focus:ring-[#0066FF]"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-[#495057]">Skill Grade</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        min="0" 
                        max="100" 
                        value={tempSkillGrade}
                        onChange={(e) => setTempSkillGrade(Number(e.target.value))}
                        className="w-16 px-2 py-1 text-sm text-right border border-[#DEE2E6] rounded focus:outline-none focus:border-[#0066FF] focus:ring-1 focus:ring-[#0066FF]"
                      />
                      <span className="text-sm font-bold text-[#0066FF]">%</span>
                    </div>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={tempSkillGrade}
                    onChange={(e) => setTempSkillGrade(Number(e.target.value))}
                    className="w-full h-2 bg-[#E9ECEF] rounded-lg appearance-none cursor-pointer accent-[#0066FF]"
                  />
                  <div className="flex justify-between text-xs text-[#6C757D] mt-1">
                    <span>0% (Beginner)</span>
                    <span>100% (Expert)</span>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-[#F8F9FA] border-t border-[#E9ECEF] flex justify-end gap-3">
                <button 
                  onClick={() => setIsEditingInfo(false)}
                  className="px-4 py-2 text-sm font-medium text-[#495057] hover:bg-[#E9ECEF] rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    setOperationName(tempOperationName);
                    setStyleNumber(tempStyleNumber);
                    setSkillGrade(tempSkillGrade);
                    setIsEditingInfo(false);
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#0066FF] hover:bg-[#0052CC] rounded-lg transition-colors flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
