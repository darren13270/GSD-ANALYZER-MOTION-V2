import fs from 'fs';

async function testUpload() {
  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) {
    console.log("API key is missing");
    return;
  }

  const fileContent = new Uint8Array(10 * 1024 * 1024); // 10MB
  for (let i = 0; i < fileContent.length; i++) fileContent[i] = i % 256;
  const size = fileContent.length;

  const initRes = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": size.toString(),
      "X-Goog-Upload-Header-Content-Type": "video/mp4",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { displayName: "test.mp4" } }),
  });
  
  if (!initRes.ok) {
    console.log(`Failed to initiate upload: ${await initRes.text()}`);
    return;
  }
  
  let uploadUrl = initRes.headers.get("X-Goog-Upload-URL");
  console.log("Upload URL:", uploadUrl);

  if (!uploadUrl) {
    console.log("No upload URL");
    return;
  }

  if (!uploadUrl.startsWith("http")) {
    const baseUrl = new URL(initRes.url).origin;
    uploadUrl = baseUrl + (uploadUrl.startsWith("/") ? "" : "/") + uploadUrl;
  }

  // Ensure API key is in the uploadUrl
  if (!uploadUrl.includes("key=")) {
    uploadUrl += `&key=${apiKey}`;
  }

  const CHUNK_SIZE = 8 * 1024 * 1024;
  let offset = 0;

  while (offset < size) {
    const chunkBlob = fileContent.slice(offset, offset + CHUNK_SIZE);
    const isFinal = offset + chunkBlob.length === size;
    
    console.log(`Uploading chunk offset ${offset}, size ${chunkBlob.length}, isFinal ${isFinal}`);
    
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "X-Goog-Upload-Offset": offset.toString(),
        "X-Goog-Upload-Command": isFinal ? "upload, finalize" : "upload",
      },
      body: chunkBlob
    });

    if (!uploadRes.ok) {
      console.error(`Upload failed with status ${uploadRes.status}: ${await uploadRes.text()}`);
      return;
    }

    if (isFinal) {
      const responseJson = await uploadRes.json();
      console.log("Uploaded file:", responseJson);
    }

    offset += chunkBlob.length;
  }
}

testUpload().catch(console.error);
