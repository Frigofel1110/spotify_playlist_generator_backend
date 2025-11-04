const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

function getGeminiClient() {
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

async function extractSongsWithGemini(imagePath) {
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Compression
    const compressedBuffer = await sharp(imagePath)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toBuffer();
    
    const base64Image = compressedBuffer.toString('base64');
    const mimeType = 'image/jpeg';

    const prompt = `Look at this music player screenshot and extract the currently playing song.

CRITICAL RULES:
- Find the MAIN song title (usually large text, ALL CAPS or Title Case)
- Find the artist name (usually below the title, smaller)
- Ignore: dates, times, app names, notifications, UI elements
- Return ONLY valid JSON: {"songs": [{"title": "...", "artist": "..."}]}
- If you can't find a song clearly: {"songs": []}

BE PRECISE. Only return songs you can clearly see.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Image
        }
      }
    ]);

    const response = result.response.text();
    console.log(`🔍 Gemini response:`, response);

    // Parser JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log(`⚠️  No JSON in response`);
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);
    let songs = parsed.songs || [];

    // Filtrer
    songs = songs.filter(song => {
      if (!song.title || song.title.length < 2) return false;
      if (/^[A-Z]{1,2}$/i.test(song.title.trim())) return false;
      return true;
    });

    return songs;

  } catch (error) {
    console.error(`❌ Gemini error:`, error.message);
    throw error;
  }
}

async function extractSongsFromMultipleImages(imagePaths, concurrencyLimit = 15) {
  const allSongs = [];
  
  for (let i = 0; i < imagePaths.length; i += concurrencyLimit) {
    const batch = imagePaths.slice(i, i + concurrencyLimit);
    
    console.log(`🔄 Batch ${Math.floor(i / concurrencyLimit) + 1}/${Math.ceil(imagePaths.length / concurrencyLimit)} (${batch.length} images)`);
    
    const promises = batch.map(imagePath => 
      extractSongsWithGemini(imagePath).catch(err => {
        console.error(`Error:`, err.message);
        return [];
      })
    );
    
    const results = await Promise.all(promises);
    allSongs.push(...results.flat());
  }
  
  // Dédupliquer
  const unique = [];
  const seen = new Set();
  for (const song of allSongs) {
    const key = `${song.title}-${song.artist}`.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(song);
    }
  }
  
  return unique;
}

module.exports = {
  extractSongsWithGemini,
  extractSongsFromMultipleImages,
};