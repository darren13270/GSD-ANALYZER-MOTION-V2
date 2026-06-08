import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("No API key");
    return;
  }

  const fileContent = new Uint8Array(1024); // 1KB dummy file
  const fileSize = fileContent.length;
  const mimeType = "video/mp4";

  console.log("1. Initiating upload...");
  const initRes = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": fileSize.toString(),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { displayName: "test.mp4" } }),
  });

  if (!initRes.ok) {
    console.error("Init failed:", await initRes.text());
    return;
  }

  let uploadUrl = initRes.headers.get("X-Goog-Upload-URL");
  console.log("Upload URL:", uploadUrl);

  console.log("2. Uploading file...");
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: fileContent,
  });

  if (!uploadRes.ok) {
    console.error("Upload failed:", uploadRes.status, await uploadRes.text());
    return;
  }

  console.log("Upload success:", await uploadRes.json());
}

test();
