const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/auth");
const spotifyService = require("../services/spotifyService");

//ROUTE : créer une playliste avec la liste des sons
router.post("/create-from-songs", requireAuth, async (req, res) => {
  try {
    const { songs, playlistName } = req.body;

    //Validation
    if (!songs || !Array.isArray(songs) || songs.length === 0) {
      return res.status(400).json({
        error: "Le champs songs est requis",
      });
    }
    console.log(`Création de la playlist pour ${req.session.user.displayName}`);
    console.log(`${songs.length} sons à traiter`);

    //Appel le service
    const result = await spotifyService.processAndCreatePlaylist(
      songs,
      req.session.user,
      playlistName || "Bombardiro crocodilo"
    );

    res.json({
      success: true,
      playlist: {
        name: result.playlist.name,
        url: result.playlist.url,
        id: result.playlist.id,
      },
      stats: {
        tracksFound: result.tracksFound,
        tracksTotal: result.tracksTotal,
        successRate: Math.round(
          (result.tracksFound / result.tracksTotal) * 100
        ),
      },
      tracks: result.tracks,
    });
  } catch (error) {
    console.error("Erreur lors de la création de la playlist", error);
    res.status(500).json({
      error: "Echec lors de la création de la playlist",
      message: error.message,
    });
  }
});

module.exports = router;
