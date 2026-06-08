import fs from "fs";

const run = async () => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("No API key");

    // Create a dummy file
    fs.writeFileSync("test.mp4", "dummy video content");
    const fileStats = fs.statSync("test.mp4");

    const initRes = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`, {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": "100", // WRONG LENGTH!
        "X-Goog-Upload-Header-Content-Type": "video/mp4",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file: { displayName: "test.mp4" } }),
    });
    
    const uploadUrl = initRes.headers.get("X-Goog-Upload-URL");
    console.log("Upload URL:", uploadUrl);

    if (!uploadUrl) {
      console.log(initRes.status, await initRes.text());
      return;
    }

    const fileBuffer = fs.readFileSync("test.mp4");
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize",
      },
      body: fileBuffer
    });
    console.log("Upload Res:", uploadRes.status, await uploadRes.text());
  } catch (e) {
    console.error(e);
  }
};
run();
