require("dotenv").config();

const express = require("express");
const session = require("express-session");
const cors = require("cors");
const fs = require("fs");  // ⭐ Ajouter
const path = require("path");  // ⭐ Ajouter
const authRoutes = require("./routes/auth");
const generatorRoutes = require("./routes/generator");
const ocrRoutes = require("./routes/ocr");

var app = express();

const PORT = process.env.PORT || 3000;

const uploadsDir = path.join(__dirname, "src", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("✅ Dossier uploads créé:", uploadsDir);
} else {
  console.log("✅ Dossier uploads existe déjà");
}

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1)
}

//CORS
const allowedOrigins = [
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  process.env.FRONTEND_URL,
].filter(Boolean);

//MIDLEWARES
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Pas autorisé pars CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json());

//SESSION
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 3600000, // 1heure
    },
  })
);

app.use("/auth", authRoutes);
app.use("/api/generator", generatorRoutes);
app.use("/api/ocr", ocrRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});
//START
app.listen(PORT, () => {
  console.log(`Backend sur le port: ${PORT}`);
});
