import fs from 'fs';

async function testUpload() {
  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) {
    console.log("API key is missing");
    return;
  }

  const fileContent = new Uint8Array(1024); // 1KB
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
  if (!uploadUrl) {
    console.log("No upload URL");
    return;
  }

  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: fileContent
  });

  const responseJson = await uploadRes.json();
  console.log("Uploaded file:", JSON.stringify(responseJson, null, 2));
}

testUpload().catch(console.error);
