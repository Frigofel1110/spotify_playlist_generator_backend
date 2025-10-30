require("dotenv").config();

const express = require("express");
const session = require("express-session");
const cors = require("cors");
const authRoutes = require("./routes/auth");
const generatorRoutes = require("./routes/generator");
const ocrRoutes = require("./routes/ocr");

var app = express();

//MIDLEWARES
app.use(
  cors({
    origin: "http://127.0.0.1:5173", //url frontend
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
      secure: false, //mettre true en prod
      sameSite: 'lax',
      maxAge: 3600000, // 1heure
    },
  })
);

app.use("/auth", authRoutes);
app.use("/generator", generatorRoutes);
app.use("/api/ocr", ocrRoutes);
//START
app.listen(3000, () => {
  console.log("Backend sur http://localhost:3000");
});
