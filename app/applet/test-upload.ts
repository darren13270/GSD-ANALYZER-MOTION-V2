import fs from "fs";

async function test() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("No API key");
    return;
  }
  const fileContent = new Uint8Array(1024); // 1KB dummy file
  const size = fileContent.length;
  const mimeType = "video/mp4";
  const displayName = "test.mp4";

  const initRes = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": size.toString(),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { displayName } }),
  });

  if (!initRes.ok) {
    console.error("Init failed:", await initRes.text());
    return;
  }

  let uploadUrl = initRes.headers.get("X-Goog-Upload-URL");
  console.log("Original Upload URL:", uploadUrl);

  const uploadRes = await fetch(uploadUrl!, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: fileContent,
  });

  if (!uploadRes.ok) {
    console.error("Upload failed:", await uploadRes.text());
  } else {
    console.log("Upload success:", await uploadRes.json());
  }
}

test();
