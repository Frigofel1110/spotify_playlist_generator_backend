const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");



function getOpenAIClient(){
    return new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });
}

// EXTRACTION AVEC VISION
async function extractSongsWithVision(imagePath) {
  try {

    const openai = getOpenAIClient(); 
    // Lire l'image en base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const ext = path.extname(imagePath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Vision + cheap
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Look at this music player screenshot and extract the currently playing song.

CRITICAL RULES:
- Find the MAIN song title (usually large text, ALL CAPS or Title Case)
- Find the artist name (usually below the title, smaller)
- Ignore: dates, times, app names, notifications, UI elements
- The song info is typically near album artwork or player controls
- Return JSON: {"songs": [{"title": "...", "artist": "..."}]}
- If you can't find a song clearly: {"songs": []}

Examples of what to look for:
- "BLINDING LIGHTS" with "The Weeknd" below
- "Giver" with "K.Flay" below
- "QUE CE SOIT CLAIR" with "Paul Kalkbrenner, Stromae" below

BE PRECISE. Only return songs you can clearly see in the music player area.`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
                detail: "high" // Meilleure qualité
              }
            }
          ]
        }
      ],
      max_tokens: 300,
      temperature: 0
    });

    const response = completion.choices[0].message.content;
    console.log("🔍 Vision response:", response);

    // Parser JSON (GPT peut ajouter markdown)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log("⚠️  No JSON in response");
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);
    let songs = parsed.songs || [];

    // Filtrer titres suspects
    songs = songs.filter(song => {
      if (song.title.length < 2) return false;
      if (/^[A-Z]{1,2}$/i.test(song.title.trim())) return false;
      return true;
    });

    return songs;

  } catch (error) {
    console.error("❌ Vision API error:", error.message);
    throw error;
  }
}

module.exports = {
extractSongsWithVision,
}