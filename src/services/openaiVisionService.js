const OpenAI = require("openai");
const path = require("path");
const sharp = require('sharp');




function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

//Traite plusieurs images en parallèle avec limite de concurrence
async function extractSongsFromMultipleImages(imagePaths, concurrencyLimit = 30) {
  const openai = getOpenAIClient();
  const results = [];


  // Traiter par batch pour éviter de surcharger l'API
  for (let i = 0; i < imagePaths.length; i += concurrencyLimit) {
    const batch = imagePaths.slice(i, i + concurrencyLimit);

    console.log(`🔄 Processing batch ${Math.floor(i / concurrencyLimit) + 1}/${Math.ceil(imagePaths.length / concurrencyLimit)} (${batch.length} images)`);

    // Traiter le batch en parallèle
    const batchPromises = batch.map(imagePath =>
      extractSongsWithVision(imagePath, openai)
        .catch(err => {
          console.error(`❌ Error processing ${path.basename(imagePath)}:`, err.message);
          return []; // Retourner tableau vide en cas d'erreur
        })
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  // Fusionner tous les résultats et dédupliquer
  const allSongs = results.flat();
  const uniqueSongs = deduplicateSongs(allSongs);

  return uniqueSongs;
}


async function extractSongsWithVision(imagePath, openaiClient = null) {
  try {
    const openai = openaiClient || getOpenAIClient();

    //compression
    const compressedBuffer = await sharp(imagePath)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toBuffer();

    // Lire l'image en base64
    const base64Image = compressedBuffer.toString('base64');
    const mimeType = 'image/jpeg';

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract song from music player screenshot. Return JSON: {"songs":[{"title":"...","artist":"..."}]}. Ignore UI elements.`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
                detail: "low"
              }
            }
          ]
        }
      ],
      max_tokens: 80,
      temperature: 0
    });

    const response = completion.choices[0].message.content;

    // Parser JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log(`⚠️  No JSON in response for ${path.basename(imagePath)}`);
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);
    let songs = parsed.songs || [];

    // Filtrer titres 
    songs = songs.filter(song => {
      if (song.title.length < 2) return false;
      if (/^[A-Z]{1,2}$/i.test(song.title.trim())) return false;
      return true;
    });

    return songs;

  } catch (error) {
    console.error(`❌ Vision API error for ${path.basename(imagePath)}:`, error.message);
    throw error;
  }
}

// Fonction pour dédupliquer les chansons
function deduplicateSongs(songs) {
  const seen = new Map();

  for (const song of songs) {
    // Normaliser pour la comparaison
    const key = `${song.title.toLowerCase().trim()}-${song.artist.toLowerCase().trim()}`;

    if (!seen.has(key)) {
      seen.set(key, song);
    }
  }

  return Array.from(seen.values());
}

module.exports = {
  extractSongsWithVision,
  extractSongsFromMultipleImages,
  deduplicateSongs
};