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



//ROUTE : POST /upload
router.post(
  "/",
  requireAuth,
  upload.array("images", 50), // Accepter jusqu'à 50 images
  async (req, res) => {
    const startTime = Date.now();
    const uploadedFiles = [];

    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      console.log(`📸 ${req.files.length} images uploaded`);

      // Récupérer tous les chemins
      const imagePaths = req.files.map(file => file.path);
      uploadedFiles.push(...imagePaths);

      // Traiter en parallèle avec limite de 5 images simultanées
      console.log("👁️  Analyzing all images in parallel...");
      const visionStart = Date.now();

      const concurrencyLimit = parseInt(process.env.VISION_CONCURRENCY_LIMIT) || 30;
      const songs = await openaiVisionService.extractSongsFromMultipleImages(
        imagePaths,
        concurrencyLimit
      );

      const visionTime = Date.now() - visionStart;
      console.log(`✅ Batch vision completed in ${visionTime}ms`);
      console.log(`🎵 Found ${songs.length} unique song(s)`);

      // Nettoyer tous les fichiers
      uploadedFiles.forEach(filePath => {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.error(`Failed to delete ${filePath}:`, e.message);
        }
      });

      const totalTime = Date.now() - startTime;
      const avgTimePerImage = Math.round(totalTime / req.files.length);

      res.json({
        success: true,
        songs: songs,
        count: songs.length,
        imagesProcessed: req.files.length,
        processingTime: totalTime,
        averageTimePerImage: avgTimePerImage,
        speedup: `${Math.round((req.files.length * 15000) / totalTime)}x faster than sequential`
      });

    } catch (error) {
      console.error("❌ Batch Error:", error.message);

      // Nettoyer tous les fichiers en cas d'erreur
      uploadedFiles.forEach(filePath => {
        try {
          fs.unlinkSync(filePath);
        } catch (e) { }
      });

      res.status(500).json({
        success: false,
        error: "Batch processing failed",
        message: error.message,
      });
    }
  }
);

module.exports = router;