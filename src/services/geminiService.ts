/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { AnalysisResult } from "../types";

const apiKey = process.env.API_KEY || (process.env.GEMINI_API_KEY || "").trim().replace(/^["']|["']$/g, '');
const ai = new GoogleGenAI({ apiKey: apiKey });

const getGsdPrompt = (expectedCycles: number, operationName: string) => `
Analyze the provided video(s) of an industrial operation: ${operationName}. 
If multiple videos are provided, they are different angles of the EXACT SAME operation. Use both angles to get a more accurate breakdown.
The video contains EXACTLY ${expectedCycles} repetitive cycles of the same operation.

CRITICAL INSTRUCTIONS:
- YOU MUST ANALYZE THE ACTUAL VIDEO PROVIDED. Do not use a generic template or hallucinate motions. Base your analysis STRICTLY on the visual evidence in the video.
- If the video does not contain sewing, do not output sewing codes. Only output codes that match the actual actions performed.
- DO NOT SKIP ANY MOTION. Every hand movement, machine action, and adjustment must be captured.
- BE EXTREMELY GRANULAR. Break down the operation into the smallest possible discrete elements.
- Ensure every second of the video is accounted for within the cycles.
- PAY SPECIAL ATTENTION to subtle motions like 'REGP' (Regrasp Part), 'TPRS' (Toggle Presser Foot), and 'HNDL' (Handling).
- DISTINGUISH between 1-hand and 2-hand operations (e.g., GP1H vs GP2H, MAP1 vs MAP2).
- OBSERVE the machine state: identify when sewing starts (MS1A/B) and ends (TTRM/CYCL).
- YOU MUST IDENTIFY EXACTLY ${expectedCycles} CYCLES. A cycle is defined as the processing of ONE COMPLETE PIECE of clothing.
- PIECE-BY-PIECE CONTINUITY: Follow the piece from the moment it is picked up until it is aside. Do not stop analyzing until the next piece begins. 
- LONG OPERATIONS: Expect that a single garment piece may involve many discrete motions. Even if the process is long, you MUST record every motion. Do not skip to the next cycle until the current piece is fully completed.
- NO GAPS: The timeline must be continuous. If you detect a gap (white space in the timeline), it means you failed the task. Every second from the start of Piece 1 to the end of Piece ${expectedCycles} must be covered by a motion code.
- END-TO-END COVERAGE: You must analyze the video until the final piece is finished. Do not stop after the first or second piece if ${expectedCycles} pieces are expected.
- DATA INTEGRITY: The quantity of motions in the first piece must be maintained for all subsequent pieces. Falling off in detail or skipping the middle of a piece is a critical failure.

Motion Identification Guidelines:
1. "Get" Phase: Look for the hand moving towards a part or tool. Ends when the part is grasped.
2. "Position/Align" Phase: Look for the hand moving the part to the machine or aligning it with another part.
3. "Sewing" Phase: Look for the machine needle moving. Distinguish between short bursts (MS1B) and longer runs (MS1A).
4. "Aside" Phase: Look for the hand moving the finished part away to a stack or bundle.

Your task:
1. Identify the exact start and end of exactly ${expectedCycles} cycles.
2. Within each cycle, identify EVERY discrete "motion" (element).
3. Assign the most accurate GSD (General Sewing Data) code from the provided list to each motion.
4. Provide the start and end time (in seconds with 3 decimal places for millisecond precision) for each motion relative to the video start.
   - CRITICAL TIMING: The startTime MUST be the EXACT fraction of a second the worker BEGINS the movement. Do not delay the start time.
   - The endTime MUST be the EXACT fraction of a second the movement STOPS.
   - THERE MUST BE NO GAPS between motions within a cycle. The end time of one motion MUST be the exact start time of the next motion.
5. Calculate the TMU (Time Measurement Unit) for each motion. (1 second = 27.8 TMU).
6. Calculate the average cycle time and the total SMV (Standard Minute Value).
   - Use a 15% allowance for SMV calculation: SMV = (Average Cycle TMU * 0.0006) * 1.15.
7. Provide a confidenceScore (0-100) for each motion. If the motion is clear and unambiguous, score it high (90-100). If it's blurry, fast, or hard to distinguish, score it lower.


GSD Reference (Full List):
- GP1E: Get Part 1 Hand (Easy)
- GP1H: Get Part 1 Hand (Normal)
- GP2H: Get Part 2 Hands
- MG2S: Match & Get 2 Parts Separately
- MG2T: Match & Get 2 Parts Together
- MAP1: Match & Add Part (1 Hand)
- MAP2: Match & Add Part (2 Hands)
- MAPE: Match & Add Part (Easy)
- GPP1: Get Part & Position (1H)
- GPP2: Get Part & Position (2H)
- REGP: Regrasp Part
- FOOT: Move Part to Presser Foot
- AM2P: Align & Match 2 Parts
- AJPT: Align & Adjust 1 Part (Top)
- ARPN: Align & Reposition
- APSH: Align by Pushing/Sliding
- GTRM: Get Trim (Zipper/Label)
- MGTB: Match & Get Trim to Body
- HNDL: Handling (Pick up / Dispose)
- MBTB: Backtack at Begin (Lever)
- MBTE: Backtack at End (Lever)
- MBAB: Backtack at Begin (Auto)
- MBAE: Backtack at End (Auto)
- TPRS: Toggle Presser Foot
- TTRM: Auto Thread Trimmer
- TBLD: Trim with Fixed Blade
- MS1A: Machine Sew > 1cm (Approx)
- MS1B: Machine Sew < 1cm (Accurate)
- MCON: Constant Speed Sewing
- MHLD: Hold & Support Assembly
- MTRN: Machine Turn (Pivot)
- STPD: Stop & Position Needle
- SEW_S: Sewing Small (< 5cm, Tacks)
- SEW_M: Sewing Medium (General Curves)
- SEW_L: Sewing Low/Long (Straight)
- SEW_H: Sewing High (Complex/Corners)
- FFLD: Form Fold
- FCRS: Form Crease
- TCUT: Trim with Scissors (1st)
- TCAT: Trim with Scissors (Add)
- TRIM: Trimming (Align Cut)
- TDCH: De-chain with Scissors
- FUNF: Form Unfold
- FOLD: Folding (Hem/Part)
- TURN: Turn Part
- MARK: Marking (Chalk/Pen)
- NOTC: Notch
- PICK: Pick up Tool
- PLCE: Place Tool Down
- SHAK: Shake Part
- BURP: Burp (Release Air)
- MEAS: Measurement (Check Spec)
- INSP: Inspect Part (Visual)
- TICK: Attach Ticket/Sticker
- CSTR: Clip Thread (Single)
- WIPE: Wipe Surface
- STMP: Stamp Part
- BNDL: Open/Close Bundle
- AS1H: Aside Part (1 Hand)
- AS2H: Aside Part (2 Hands)
- ASTK: Aside & Stack
- ASPH: Aside by Pushing
- ATOS: Aside by Tossing
- ABDL: Aside & Bundle
- ASFT: Aside to Floor/Table
- AHNG: Hang Part on Rail
- CYCL: Machine Cycle (Stop/Start/Trim)
- IRON: Ironing (Steam/Press)

Output the results in a structured JSON format. Ensure the times are accurate to the video frames and provide millisecond precision (e.g., 1.234).
`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    cycles: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          cycleNumber: { type: Type.INTEGER },
          motions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                motionDescription: { type: Type.STRING },
                gsdCode: { type: Type.STRING },
                startTime: { type: Type.NUMBER },
                endTime: { type: Type.NUMBER },
                duration: { type: Type.NUMBER },
                tmu: { type: Type.NUMBER },
                confidenceScore: { type: Type.NUMBER },
              },
              required: ["id", "motionDescription", "gsdCode", "startTime", "endTime", "duration", "tmu", "confidenceScore"],
            },
          },
          totalTmu: { type: Type.NUMBER },
        },
        required: ["cycleNumber", "motions", "totalTmu"],
      },
    },
    averageCycleTime: { type: Type.NUMBER },
    totalSmv: { type: Type.NUMBER },
  },
  required: ["cycles", "averageCycleTime", "totalSmv"],
};

export type ProgressCallback = (status: string, progress?: number) => void;

export async function analyzeOperationVideo(
  videos: File[], 
  operationName: string,
  expectedCycles: number = 3, 
  cacheKey?: string,
  onProgress?: ProgressCallback,
  signal?: AbortSignal
): Promise<AnalysisResult> {
  if (signal?.aborted) throw new Error("Analysis cancelled");

  // Helper to allow cancelling SDK promises that don't natively support abort signals
  const withAbort = <T>(promise: Promise<T>): Promise<T> => {
    if (!signal) return promise;
    let abortListener: () => void;
    
    const abortPromise = new Promise<never>((_, reject) => {
      if (signal.aborted) return reject(new Error("Analysis cancelled"));
      abortListener = () => reject(new Error("Analysis cancelled"));
      signal.addEventListener('abort', abortListener);
    });

    return Promise.race([promise, abortPromise]).finally(() => {
      if (abortListener) signal.removeEventListener('abort', abortListener);
    });
  };

  if (cacheKey) {
    try {
      const docRef = doc(db, 'videoCache', cacheKey);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        console.log("Returning cached analysis result from Firebase for:", cacheKey);
        onProgress?.("Loading cached results...", 100);
        return JSON.parse(docSnap.data().resultJson) as AnalysisResult;
      }
    } catch (e) {
      console.warn("Failed to read from Firebase cache:", e);
    }
  }

  const dynamicApiKey = process.env.API_KEY || (process.env.GEMINI_API_KEY || "").trim().replace(/^["']|["']$/g, '');
  if (!dynamicApiKey) throw new Error("API key is missing");

  const localAi = new GoogleGenAI({ apiKey: dynamicApiKey });

  const uploadedFiles = [];
  const TOTAL_STAGES = 3; // Upload, Process, Analyze
  
  // Phase 1: Uploading (0-40%)
  for (let i = 0; i < videos.length; i++) {
    if (signal?.aborted) throw new Error("Analysis cancelled");
    const file = videos[i];
    const baseProgress = (i / videos.length) * 40;
    const progressShare = (1 / videos.length) * 40;
    
    onProgress?.(`Uploading video ${i + 1}/${videos.length}...`, Math.floor(baseProgress));
    const sanitizedDisplayName = file.name.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 128) || "video_file";
    
    try {
      let subProgress = 0;
      const progressInterval = setInterval(() => {
        subProgress += file.size > 50000000 ? 0.5 : 2; 
        if (subProgress > 95) subProgress = 95;
        const totalProgress = baseProgress + (subProgress / 100) * progressShare;
        onProgress?.(`Uploading video ${i + 1}/${videos.length}...`, Math.floor(totalProgress));
      }, 500);

      const uploadResult = await withAbort(localAi.files.upload({
        file: file,
        config: {
          displayName: sanitizedDisplayName,
          mimeType: file.type || "video/mp4",
        }
      }));
      clearInterval(progressInterval);
      if (signal?.aborted) throw new Error("Analysis cancelled");
      
      uploadedFiles.push(uploadResult);
      onProgress?.(`Video ${i + 1} uploaded...`, Math.floor(baseProgress + progressShare));
    } catch (err) {
      if (signal?.aborted || (err instanceof Error && err.message === "Analysis cancelled")) {
        throw new Error("Analysis cancelled");
      }
      throw new Error(`Upload failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Phase 2: Processing (40-70%)
  if (signal?.aborted) throw new Error("Analysis cancelled");
  onProgress?.("Gemini is processing video content...", 40);
  const processingStartProgress = 40;
  const processingEndProgress = 70;
  const processingShare = processingEndProgress - processingStartProgress;
  
  for (let i = 0; i < uploadedFiles.length; i++) {
    const file = uploadedFiles[i];
    let isActive = false;
    let attempts = 0;
    const maxAttempts = 150; // 5 minutes max processing wait per file
    
    while (!isActive && attempts < maxAttempts) {
      if (signal?.aborted) throw new Error("Analysis cancelled");
      const fileStatus = await withAbort(localAi.files.get({ name: file.name }));
      const currentProcessingProgress = processingStartProgress + ((attempts / maxAttempts) * processingShare);
      
      if (fileStatus.state === "ACTIVE") {
        isActive = true;
      } else if (fileStatus.state === "FAILED") {
        throw new Error("Video processing failed in Gemini API");
      } else {
        onProgress?.(`Processing video ${i + 1}/${uploadedFiles.length}...`, Math.floor(currentProcessingProgress));
        await new Promise((resolve) => setTimeout(resolve, 2000));
        attempts++;
      }
    }
    
    if (!isActive) {
      throw new Error("Video processing timed out in Gemini. Please try again with a slightly shorter or lower resolution video.");
    }
  }
  
  if (signal?.aborted) throw new Error("Analysis cancelled");
  onProgress?.("Video processing complete...", 70);

  // Phase 3: AI Analysis (70-100%)
  const parts: any[] = [{ text: getGsdPrompt(expectedCycles, operationName) }];
  for (const file of uploadedFiles) {
    parts.push({
      fileData: {
        fileUri: file.uri,
        mimeType: file.mimeType,
      },
    });
  }

  onProgress?.("AI is analyzing motion cycles across the timeline...", 75);
  let response;
  const modelId = "gemini-3-flash-preview"; 
  
  if (signal?.aborted) throw new Error("Analysis cancelled");
  
  try {
    // Fake progress interval for the last mile since LLM response is long-running
    let analysisProgress = 75;
    const analysisInterval = setInterval(() => {
      analysisProgress += 0.1; // Even slower increment to give AI room to think
      if (analysisProgress > 98) analysisProgress = 98;
      onProgress?.("AI is analyzing motion cycles across the timeline...", Math.floor(analysisProgress));
    }, 1000);

    // If abort is thrown during the request, catch it gracefully
    const generatePromise = localAi.models.generateContent({
      model: modelId,
      contents: [{ parts }],
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1,
      },
    });

    response = await withAbort(generatePromise);
    
    clearInterval(analysisInterval);
    if (signal?.aborted) throw new Error("Analysis cancelled");
    onProgress?.("Analysis complete, preparing data...", 99);
  } catch (e: any) {
    if (signal?.aborted || e.name === 'AbortError' || e.message === "Analysis cancelled") {
      throw new Error("Analysis cancelled");
    }

    // Cleanup files on failure
    for (const file of uploadedFiles) {
      try {
        await localAi.files.delete({ name: file.name });
      } catch (cleanupErr) {
        console.error("Failed to cleanup file after error:", cleanupErr);
      }
    }
    
    // Parse the error dynamically to show a clean message over raw JSON
    let errorMessage = e instanceof Error ? e.message : String(e);
    
    // Check if it's a JSON string error (common with Proxy or SDK responses)
    try {
      if (errorMessage.includes('{"error":') || (errorMessage.startsWith('{') && errorMessage.endsWith('}'))) {
        const start = errorMessage.indexOf('{');
        const parsed = JSON.parse(errorMessage.substring(start));
        if (parsed.error && parsed.error.message) {
          errorMessage = parsed.error.message;
        } else if (parsed.message) {
           errorMessage = parsed.message;
        }
      }
    } catch {
      // Keep original
    }

    if (errorMessage.includes("quota") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
      throw new Error(`AI Quota Exceeded: Your daily usage limit was reached. Please wait a few minutes and try again.`);
    }

    if (errorMessage.includes("entity was not found") || errorMessage.includes("404")) {
      throw new Error(`The AI service or selected video context was not found. If this persists, please try re-uploading the video.`);
    }

    throw new Error(`AI Analysis failed: ${errorMessage}`);
  }

  // Cleanup files after successful analysis (don't wait for it to finish)
  uploadedFiles.forEach(file => {
    localAi.files.delete({ name: file.name }).catch(e => console.warn("Cleanup failed:", e));
  });

  const responseText = response.text;
  if (!responseText) {
    const finishReason = (response as any).candidates?.[0]?.finishReason;
    if (finishReason === "SAFETY") {
      throw new Error("AI Analysis stopped unexpectedly due to safety filters. Please ensure the video content is appropriate.");
    }
    if (finishReason === "RECITATION") {
      throw new Error("AI Analysis failed: The model identified copyrighted content and refused to process.");
    }
    throw new Error("No response from AI. The video might be too complex or long for the current processing window.");
  }

  let result: AnalysisResult;
  try {
    // Clean up response text if it contains markdown markers (though responseMimeType should handle it)
    const cleanJson = responseText.replace(/^```json\n?|\n?```$/g, '').trim();
    result = JSON.parse(cleanJson) as AnalysisResult;
  } catch (e) {
    console.error("Failed to parse AI response:", responseText);
    throw new Error("AI returned a malformed data structure. This usually happens with very long videos. Please try analyzing fewer cycles or a shorter segment.");
  }
  
  if (cacheKey) {
    try {
      const docRef = doc(db, 'videoCache', cacheKey);
      await setDoc(docRef, {
        resultJson: JSON.stringify(result),
        createdAt: Date.now()
      });
    } catch (e) {
      console.warn("Failed to save to Firebase cache:", e);
    }
  }
  
  onProgress?.("Completed!", 100);
  return result;
}
