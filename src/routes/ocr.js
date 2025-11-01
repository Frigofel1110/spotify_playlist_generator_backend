const express = require("express");
const router = express.Router();
const multer = require("multer");
const Tesseract = require("tesseract.js");
const path = require("path");
const fs = require("fs");
const requireAuth = require("../middleware/auth");

const uploadsDir = process.env.NODE_ENV === "production" 
  ? "/tmp/uploads"
  : path.join(__dirname, "..", "uploads");

// ⭐ Créer le dossier
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("✅ Dossier uploads créé:", uploadsDir);
}
//CONFIG MULTER
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);  // ⭐ Chemin dynamique
  },

  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  },
});

//Filtrer les types de fichiers accepté
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
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

  console.log(`\n📝 Parsing de ${lines.length} lignes...`);

  const songs = [];
  const patterns = [
    /(.+)\s*-\s*(.+)/, // "Titre - Artiste"
    /(.+)\s*–\s*(.+)/, // "Titre – Artiste" (tiret long)
    /(.+)\s+by\s+(.+)/i, // "Titre by Artiste"
  ];

  for (const line of lines) {
    // ⭐ NETTOYAGE AGRESSIF
    let cleanedLine = line
      // Enlever "Mix -" au début
      .replace(/^(Mix\s*-\s*)/i, "")
      // Enlever toutes les parenthèses et leur contenu (complet ou partiel)
      .replace(/\([^)]*$/g, "") // Parenthèse ouverte non fermée à la fin
      .replace(/\([^)]*\)/g, "") // Parenthèses complètes
      // Enlever les crochets
      .replace(/\[[^\]]*$/g, "")
      .replace(/\[[^\]]*\]/g, "")
      // Enlever les deux-points traînants
      .replace(/\s*:\s*$/g, "")
      // Enlever "Mise a jour", "vues", etc.
      .replace(/Mise\s+[aà]\s+jour.*/gi, "")
      .replace(/\d+\s+(vues?|views?).*/gi, "")
      // Enlever les mots-clés YouTube courants
      .replace(/\b(Official|Music|Video|Audio|Lyric|Visualizer)\b/gi, "")
      // Nettoyer les espaces multiples
      .replace(/\s+/g, " ")
      .trim();

    console.log(`  Original: "${line}"`);
    console.log(`  Cleaned:  "${cleanedLine}"`);

    // Ignorer les lignes qui ressemblent à des durées
    if (/^\d+:\d+$/.test(cleanedLine)) {
      console.log(`  ⏭️  Ignoré (durée)`);
      continue;
    }

    // Ignorer les lignes trop courtes
    if (cleanedLine.length < 5) {
      console.log(`  ⏭️  Ignoré (trop court)`);
      continue;
    }

    // Ignorer les lignes qui sont juste des chiffres
    if (/^\d+$/.test(cleanedLine)) {
      console.log(`  ⏭️  Ignoré (numéro)`);
      continue;
    }

    // Ignorer les lignes qui ne contiennent que des caractères spéciaux
    if (/^[^a-zA-Z0-9]+$/.test(cleanedLine)) {
      console.log(`  ⏭️  Ignoré (caractères spéciaux uniquement)`);
      continue;
    }

    // Ignorer les lignes avec trop de virgules (listes d'artistes)
    if ((cleanedLine.match(/,/g) || []).length > 2) {
      console.log(`  ⏭️  Ignoré (liste d'artistes)`);
      continue;
    }

    // Tester les patterns
    let matched = false;
    for (const pattern of patterns) {
      if (pattern.test(cleanedLine)) {
        songs.push(cleanedLine);
        console.log(`  ✅ Ajouté: "${cleanedLine}"`);
        matched = true;
        break;
      }
    }

    if (!matched) {
      console.log(`  ⚠️  Ignoré (pas de pattern)`);
    }
  }

  console.log(`\n🎵 Total: ${songs.length} chansons parsées\n`);
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
