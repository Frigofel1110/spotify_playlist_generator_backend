require("dotenv").config();

const express = require("express");
const session = require("express-session");
const cors = require("cors");
const authRoutes = require("./routes/auth");
const generatorRoutes = require("./routes/generator");
const ocrRoutes = require("./routes/ocr");

var app = express();

const PORT = process.env.PORT || 3000;

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
    credentials: "true",
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
      secure: process.env.NODE_ENV === "production" ? "true" : "false",
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
app.listen(3000, () => {
  console.log(`Backend sur le port: ${PORT}`);
});
