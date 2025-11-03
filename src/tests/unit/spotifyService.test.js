// backend/src/tests/unit/spotifyService.test.js
const {
  searchTrack,
  searchTracks,
  addTracksToPlaylist,
} = require('../../services/spotifyService');
const axios = require('axios');

jest.mock('axios');

describe('SpotifyService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== searchTrack ====================
  describe('searchTrack', () => {
    it('doit retourner le bon format', async () => {
      axios.get.mockResolvedValue({
        data: {
          tracks: {
            items: [{
              uri: 'spotify:track:123',
              name: 'Test Song',
              artists: [{ name: 'Test Artist' }],
              id: 'track123'
            }]
          }
        }
      });

      const result = await searchTrack('Test Song', 'Test Artist', 'token');

      expect(result).toEqual({
        uri: 'spotify:track:123',
        name: 'Test Song',
        artist: 'Test Artist',
        id: 'track123'
      });
    });

    it('doit retourner null si aucun résultat', async () => {
      axios.get.mockResolvedValue({
        data: { tracks: { items: [] } }
      });

      const result = await searchTrack('Unknown', 'Unknown', 'token');

      expect(result).toBeNull();
    });

    it('doit gérer artist manquant', async () => {
      axios.get.mockResolvedValue({
        data: {
          tracks: {
            items: [{
              uri: 'spotify:track:123',
              name: 'Test Song',
              artists: [],
              id: 'track123'
            }]
          }
        }
      });

      const result = await searchTrack('Test', 'Test', 'token');

      expect(result.artist).toBe('Artiste inconnu');
    });
  });

  // ==================== searchTracks ====================
  describe('searchTracks', () => {
    it('doit dédupliquer les tracks avec même ID', async () => {
      // Mock searchTrack pour retourner 2 fois le même track
      axios.get
        .mockResolvedValueOnce({
          data: {
            tracks: {
              items: [{
                uri: 'spotify:track:123',
                name: 'Duplicate',
                artists: [{ name: 'Artist' }],
                id: 'same-id'
              }]
            }
          }
        })
        .mockResolvedValueOnce({
          data: {
            tracks: {
              items: [{
                uri: 'spotify:track:123',
                name: 'Duplicate',
                artists: [{ name: 'Artist' }],
                id: 'same-id' // Même ID !
              }]
            }
          }
        });

      const songs = [
        { title: 'Song 1', artist: 'Artist' },
        { title: 'Song 2', artist: 'Artist' }
      ];
      const user = { accessToken: 'token' };

      const result = await searchTracks(songs, user);

      expect(result.tracksFound).toBe(1); // Dédupliqué !
      expect(result.tracksTotal).toBe(2);
      expect(result.tracks).toHaveLength(1);
    });

    it('doit filtrer les résultats null', async () => {
      axios.get
        .mockResolvedValueOnce({
          data: {
            tracks: {
              items: [{
                uri: 'spotify:track:123',
                name: 'Found',
                artists: [{ name: 'Artist' }],
                id: 'track1'
              }]
            }
          }
        })
        .mockResolvedValueOnce({
          data: { tracks: { items: [] } } // Pas de résultat
        });

      const songs = [
        { title: 'Found', artist: 'Artist' },
        { title: 'Not Found', artist: 'Unknown' }
      ];
      const user = { accessToken: 'token' };

      const result = await searchTracks(songs, user);

      expect(result.tracksFound).toBe(1);
      expect(result.tracksTotal).toBe(2);
      expect(result.tracks).toHaveLength(1);
    });

    it('doit gérer une liste vide', async () => {
      const result = await searchTracks([], { accessToken: 'token' });

      expect(result.tracksFound).toBe(0);
      expect(result.tracksTotal).toBe(0);
      expect(result.tracks).toEqual([]);
    });
  });

  // ==================== addTracksToPlaylist ====================
  describe('addTracksToPlaylist', () => {
    it('doit ajouter des tracks en 1 batch si < 100', async () => {
      axios.post.mockResolvedValue({ data: {} });

      const uris = Array(50).fill('spotify:track:123');

      await addTracksToPlaylist('playlist123', uris, 'token');

      expect(axios.post).toHaveBeenCalledTimes(1);
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.spotify.com/v1/playlists/playlist123/tracks',
        { uris: expect.arrayContaining(uris) },
        expect.any(Object)
      );
    });

    it('doit ajouter des tracks en 2 batches si > 100', async () => {
      axios.post.mockResolvedValue({ data: {} });

      const uris = Array(150).fill().map((_, i) => `spotify:track:${i}`);

      await addTracksToPlaylist('playlist123', uris, 'token');

      expect(axios.post).toHaveBeenCalledTimes(2);
      
      // Premier batch : 100 tracks
      expect(axios.post).toHaveBeenNthCalledWith(
        1,
        expect.any(String),
        { uris: expect.arrayContaining(uris.slice(0, 100)) },
        expect.any(Object)
      );
    });

    it('doit throw si erreur Spotify', async () => {
      axios.post.mockRejectedValue({
        response: { data: { error: 'Invalid playlist' } }
      });

      await expect(
        addTracksToPlaylist('bad-id', ['spotify:track:123'], 'token')
      ).rejects.toThrow('Impossible que les sons soient ajoutés');
    });
  });
});