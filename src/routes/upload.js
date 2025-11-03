const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const requireAuth = require("../middleware/auth");
const openaiVisionService = require('../services/openaiVisionService');



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



// ROUTE : POST /upload

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

      const songs = await openaiVisionService.extractSongsWithVision(imagePath);

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
        } catch (e) { }
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