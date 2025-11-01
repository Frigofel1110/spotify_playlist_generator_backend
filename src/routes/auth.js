const express = require("express");
const router = express.Router();
const querystring = require("querystring");
const generateRandomString = require("../utils/helpers");
const axios = require("axios");

//CONFIG SPOTIFY
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;

//ROUTE 1 : LOGIN
router.get("/login", (req, res) => {
  console.log("Login route called");
  const state = generateRandomString(16);

  //STOCKER state en session
   req.session.spotifyState = state;

  const scope =
    "user-read-private user-read-email playlist-modify-public playlist-modify-private";

  //CONSTRUIRE L'URL SPOTIFY
  const authUrl =
    "https://accounts.spotify.com/authorize?" +
    querystring.stringify({
      response_type: "code",
      client_id: CLIENT_ID,
      scope: scope,
      redirect_uri: REDIRECT_URI,
      state: state,
    });

  //REDIRIGER VERS SPOTIFY
  res.redirect(authUrl);
});

//ROUTE 2 : CALLBACK
router.get("/callback", async (req, res) => {
  const code = req.query.code || null;
  const state = req.query.state || null;
  const error = req.query.error || null;

  //Vérifier si l'utilisateur à accepter ou refusé
  if (error) {
    return res.status(400).json({ error: "l'utilisateur a refusé l'accès" });
  }

  //Vérifier le state (protection CSRF)
  if (state !== req.session.spotifyState) {
    return res
      .status(403)
      .json({ error: "Le state ne corresponds pas (attaque CSRF possible" });
  }
  try {
    //Echanger code contre access_token
    const tokenResponse = await axios.post(
      "https://accounts.spotify.com/api/token",
      querystring.stringify({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: REDIRECT_URI,
      }),
      {
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(CLIENT_ID + ":" + CLIENT_SECRET).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    //Récupérer infos utilisateur
    const userResponse = await axios.get("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const userData = userResponse.data;

    //Stocker en session
    req.session.user = {
      id: userData.id,
      email: userData.email,
      displayName: userData.display_name,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + expires_in * 1000,
    };

    //Nettoyer le state
    delete req.session.spotifyState;

    req.session.save((err) => {
      if (err) {
        console.error("Erreur lors de la sauvegarde de la session: ", err);
        return res.status(500).json({
          error: "Erreur lors de la sauvegarde de la session",
        });
      }
    });

    console.log("Session sauvegardé: ", req.session.user.id);

    //Rediriger vers le frontend
    res.redirect(process.env.FRONTEND_URL || "https://127.0.0.1:5173");
  } catch (error) {
    console.error(
      "Erreur lors du callback",
      error.response?.data || error.message
    );
    res.status(500).json({ error: `Echec lors de l'authentification` });
  }
});

//ROUTE 3 : ME (teste pour la connexion)
router.get("/me", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "pas authentifié" });
  }

  if (Date.now() >= req.session.user.expiresAt) {
    return res.status(401).json({ error: "token expiré" });
  }

  res.json({
    id: req.session.user.id,
    email: req.session.user.email,
    displayName: req.session.user.displayName,
  });
});

//ROUTE 4 : LOGOUT
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Echec lors de la déconnexion" });
    }
    res.json({ message: "Déconnexion réussi" });
  });
});

module.exports = router;
