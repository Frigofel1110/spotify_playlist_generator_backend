const express = require("express");
const router = express.Router();
const multer = require("multer");
const OpenAI = require("openai");
const path = require("path");
const fs = require("fs");
const requireAuth = require("../middleware/auth");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Config multer
const uploadsDir = process.env.NODE_ENV === "production" 
  ? "/tmp/uploads"
  : path.join(__dirname, "..", "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
    cb(null, allowedTypes.includes(file.mimetype));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ═══════════════════════════════════════════════════════════
// EXTRACTION DIRECTE AVEC VISION
// ═══════════════════════════════════════════════════════════

async function extractSongsWithVision(imagePath) {
  try {
    // Lire l'image en base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const ext = path.extname(imagePath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Vision + cheap
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Look at this music player screenshot and extract the currently playing song.

CRITICAL RULES:
- Find the MAIN song title (usually large text, ALL CAPS or Title Case)
- Find the artist name (usually below the title, smaller)
- Ignore: dates, times, app names, notifications, UI elements
- The song info is typically near album artwork or player controls
- Return JSON: {"songs": [{"title": "...", "artist": "..."}]}
- If you can't find a song clearly: {"songs": []}

Examples of what to look for:
- "BLINDING LIGHTS" with "The Weeknd" below
- "Giver" with "K.Flay" below
- "QUE CE SOIT CLAIR" with "Paul Kalkbrenner, Stromae" below

BE PRECISE. Only return songs you can clearly see in the music player area.`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
                detail: "high" // Meilleure qualité
              }
            }
          ]
        }
      ],
      max_tokens: 300,
      temperature: 0
    });

    const response = completion.choices[0].message.content;
    console.log("🔍 Vision response:", response);
    
    // Parser JSON (GPT peut ajouter markdown)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log("⚠️  No JSON in response");
      return [];
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    let songs = parsed.songs || [];
    
    // Filtrer titres suspects
    songs = songs.filter(song => {
      if (song.title.length < 2) return false;
      if (/^[A-Z]{1,2}$/i.test(song.title.trim())) return false;
      return true;
    });
    
    return songs;
    
  } catch (error) {
    console.error("❌ Vision API error:", error.message);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════
// ROUTE : POST /upload
// ═══════════════════════════════════════════════════════════

router.post(
  "/upload",
  requireAuth,
  upload.single("image"),
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const imagePath = req.file.path;
      console.log("📸 Image uploaded:", path.basename(imagePath));

      // Vision directe
      console.log("👁️  Analyzing with Vision AI...");
      const visionStart = Date.now();
      
      const songs = await extractSongsWithVision(imagePath);
      
      const visionTime = Date.now() - visionStart;
      console.log(`✅ Vision completed in ${visionTime}ms`);
      console.log(`🎵 Found ${songs.length} song(s):`, songs);

      // Nettoyer
      fs.unlinkSync(imagePath);

      const totalTime = Date.now() - startTime;
      
      res.json({
        success: true,
        songs: songs,
        count: songs.length,
        processingTime: totalTime
      });

    } catch (error) {
      console.error("❌ Error:", error.message);

      if (req.file?.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {}
      }

      res.status(500).json({
        success: false,
        error: "Processing failed",
        message: error.message,
      });
    }
  }
);

module.exports = router;