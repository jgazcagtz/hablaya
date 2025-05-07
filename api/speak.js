export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { text } = await req.json();
    
    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid text input' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "tts-1",
        voice: "nova", // Can be "alloy", "echo", "fable", "onyx", "nova", or "shimmer"
        input: text,
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI TTS request failed with status ${response.status}`);
    }

    // Get the audio data as a blob
    const audioBlob = await response.blob();

    // Convert blob to array buffer
    const audioArrayBuffer = await audioBlob.arrayBuffer();

    // Create a new response with the audio data
    return new Response(audioArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
      },
    });
  } catch (error) {
    console.error('Error in TTS API:', error);
    return new Response(
      JSON.stringify({ 
        error: 'An error occurred while generating speech',
        details: error.message 
      }), 
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
