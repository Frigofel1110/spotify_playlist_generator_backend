const express = require("express");
const router = express.Router();
const multer = require("multer");
const Tesseract = require("tesseract.js");
const path = require("path");
const fs = require("fs");
const requireAuth = require("../middleware/auth");

//CONFIG MULTER
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "src/uploads"); //dossier ou sauvegarder
  },

  filename: (req, file, cb) => {
    //Nom unique
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  },
});

//Filtrer les types de fichiers accepté
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true); //Accepter
  } else {
    cb(new Error("Type de fichier non autorisé"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, //10MB max
  },
});

//FONCTION : Parser le texte OCR
function parseSongsFromText(text) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const songs = [];

  //Patterns pour détécter l'artiste et le titre
  const patterns = [
    /(.+)\s*-\s*(.+)/, // "Titre - Artiste"
    /(.+)\s*–\s*(.+)/, // "Titre – Artiste" (tiret long)
    /(.+)\s+by\s+(.+)/i, // "Titre by Artiste"
  ];

  for (const line of lines) {
    //Ignorer les lignes trop courtes
    if (line.length < 5) continue;

    //tester les patterns
    for (const pattern of patterns) {
      if (pattern.test(line)) {
        songs.push(line);
        break;
      }
    }
  }
  return songs;
}

//ROUTE : POST /upload
router.post(
  "/upload",
  requireAuth,
  upload.single("image"),
  async (req, res) => {
    try {
      //Vérifier si le fichier est uploadé
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const imagePath = req.file.path;
      console.log("Images uploaded:", imagePath);

      //Lancer OCR
      console.log("starting OCR...");
      const {
        data: { text },
      } = await Tesseract.recognize(imagePath, "eng", {
        logger: (info) => console.log(info),
      });
      console.log("OCR completed");
      console.log("Raw text:", text);

      // Parser le texte
      const songs = parseSongsFromText(text);
      console.log("sons trouvé:", songs);

      //Supprimer le fichier uploadé
      fs.unlinkSync(imagePath);

      //Retourner le résultat
      res.json({
        sucess: true,
        songs: songs,
        rawText: text,
        count: songs.length,
      });
    } catch (error) {
      console.error("OCR error:", error);

      //Nettoyer le fichier en cas d'erreur
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {
          console.error("Echec lors de la suppréssion du fichier", e);
        }
      }
      res.status(500).json({
        error: "Echec lors du proccessus OCR",
        message: error.message,
      });
    }
  }
);

module.exports = router;
