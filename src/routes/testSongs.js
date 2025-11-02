const express = require('express');
const router = express.Router();
const spotifyService = require('../services/spotifyService')
const requireAuth = require('../middleware/auth');

//ROUTE : tester la recherche des songs sur spotify via l'extrait de texte de l'ocr
router.post('/test-search-songs', requireAuth, async (req, res) => {
    try {

        const { songs } = req.body;
        const result = await spotifyService.searchTracks(
            songs,
            req.user
        );
        res.json({
            success: true,
            stats: {
                tracksFound: result.tracksFound,
                tracksTotal: result.tracksTotal,

            },
            tracks: result.tracks
        })
    } catch (error) {
        console.error('erreur lors du test de recherche de sons via spotify', error);
    }
});


module.exports = router;