const axios = require("axios");

//Chercher un son
async function searchTrack(query, accessToken) {
  try {
    const response = await axios.get("https://api.spotify.com/v1/search", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params: {
        q: query,
        type: "track",
        limit: 1,
      },
    });

    const tracks = response.data.tracks.items;
    if (tracks.length === 0) {
      console.log("aucun résultat lors de la recherche du son: ", query);
      return null;
    }
    const track = tracks[0];

    if (!track.uri || track.id || !track.name) {
      console.log(`track incomplet ${query}`, track);
    }
    return {
      uri: track.uri,
      name: track.name,
      artist: track.artists[0]?.name || "Artiste inconnu",
      id: track.id,
    };
  } catch (error) {
    console.error(
      "Erreur lors de la recherche du son pour: ",
      query,
      " ",
      error.message
    );
  }
}
//Créer une playlist
async function createPlaylist(userId, playlistName, accessToken) {
  try {
    const response = await axios.post(
      `https://api.spotify.com/v1/users/${userId}/playlists`,
      {
        name: playlistName,
        description: "Playlist générée",
        public: false,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    return {
      id: response.data.id,
      url: response.data.external_urls.spotify,
      name: response.data.name,
    };
  } catch (error) {
    console.error(
      "Erreur le de la création de la playlist",
      error.response?.data || error.message
    );
    throw new Error("Impossible de créer la playlist");
  }
}

//Ajouter les sons à la playlist
async function addTracksToPlaylist(playlistId, trackUris, accessToken) {
  try {
    const batchSize = 100;

    for (let i = 0; i < trackUris.length; i += batchSize) {
      const batch = trackUris.slice(i, i + batchSize);

      await axios.post(
        `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
        {
          uris: batch,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      console.log(
        `Ajouté ${batch.length} sons (batch ${Math.floor(i / batchSize) + 1})`
      );
      return true;
    }
  } catch (error) {
    console.error(
      "Erreur ajout des sons",
      error.response?.data || error.message
    );
    throw new Error("Impossible que les sons soient ajoutés");
  }
}

//Fonction principal : Process
async function processAndCreatePlaylist(
  songs,
  user,
  playlistName = "Playlist généré custom"
) {
  const accessToken = user.accessToken;
  const userId = user.id;

  console.log("Traitement de: ", songs.length, " chansons...");

  //Cherche tous les sons
  const searchPromises = songs.map((query) => searchTrack(query, accessToken));
  const searchResults = await Promise.all(searchPromises);

  //Filtrer les résultats
  const foundTracks = searchResults.filter((track) => track !== null);

  console.log(`${foundTracks.length} sons trouvés `);

  if (foundTracks.length === 0) {
    throw new Error("Aucun son trouvé sur spotify");
  }

  //Créer la playlist
  console.log("Créationd e la playlist en cours...");
  const playlist = await createPlaylist(userId, playlistName, accessToken);
  console.log(`Playlist crée: ${playlist.url}`);

  //Ajouter les sons à la playlist
  console.log(`Ajout des sons à la playlist... `);
  const trackUris = foundTracks.map((track) => track.uri);
  await addTracksToPlaylist(playlist.id, trackUris, accessToken);

  //Retourner le resultat
  return {
    playlist: playlist,
    tracksFound: foundTracks.length,
    tracksTotal: songs.length,
    tracks: foundTracks,
  };
}

module.exports = {
  searchTrack,
  createPlaylist,
  addTracksToPlaylist,
  processAndCreatePlaylist,
};
