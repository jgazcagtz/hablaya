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
    // Check if API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key not found');
      return new Response(JSON.stringify({ 
        error: 'OpenAI API key not configured',
        details: 'Please set OPENAI_API_KEY environment variable'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const language = formData.get('language') || 'en';
    const prompt = formData.get('prompt') || 'This is an English language learning session. Please transcribe clearly and provide pronunciation feedback.';
    
    if (!file) {
      return new Response(JSON.stringify({ error: 'No audio file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate file
    if (file.size === 0) {
      return new Response(JSON.stringify({ error: 'Audio file is empty' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('Processing audio file:', {
      size: file.size,
      type: file.type,
      name: file.name
    });

    // Create a new FormData object for OpenAI API
    const openAIFormData = new FormData();
    openAIFormData.append('file', file);
    openAIFormData.append('model', 'whisper-1');
    openAIFormData.append('language', language);
    openAIFormData.append('prompt', prompt);

    console.log('Sending to OpenAI API...');

    // Enhanced Whisper API call with language learning context
    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: openAIFormData
    });

    console.log('OpenAI response status:', whisperResponse.status);

    if (!whisperResponse.ok) {
      const errorData = await whisperResponse.json().catch(() => ({}));
      console.error('OpenAI API Error:', errorData);
      throw new Error(errorData.error?.message || `OpenAI API error: ${whisperResponse.status}`);
    }

    const result = await whisperResponse.json();
    console.log('OpenAI transcription result:', result);
    
    if (!result.text) {
      throw new Error('No transcription text received from OpenAI');
    }
    
    // Enhanced response with language learning metadata
    const enhancedResult = {
      text: result.text,
      language: language,
      confidence: result.confidence || 0.8, // Default confidence if not provided
      pronunciation_analysis: analyzePronunciation(result.text),
      learning_suggestions: generateLearningSuggestions(result.text),
      timestamp: new Date().toISOString()
    };

    console.log('Returning enhanced result:', enhancedResult);

    return new Response(JSON.stringify(enhancedResult), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Transcription error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to transcribe audio',
        details: error.message 
      }), 
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// Function to analyze pronunciation patterns
function analyzePronunciation(text) {
  const analysis = {
    clarity: 'good',
    pace: 'moderate',
    suggestions: []
  };

  // Simple pronunciation analysis based on common patterns
  const words = text.toLowerCase().split(' ');
  
  // Check for common pronunciation challenges
  const challengingWords = words.filter(word => 
    word.includes('th') || 
    word.includes('ch') || 
    word.includes('sh') ||
    word.endsWith('ing') ||
    word.endsWith('ed')
  );

  if (challengingWords.length > 0) {
    analysis.suggestions.push(`Focus on: ${challengingWords.slice(0, 3).join(', ')}`);
  }

  // Analyze pace based on word count
  if (words.length < 5) {
    analysis.pace = 'slow';
    analysis.suggestions.push('Try speaking a bit faster for more natural flow');
  } else if (words.length > 15) {
    analysis.pace = 'fast';
    analysis.suggestions.push('Good pace! Consider adding pauses for clarity');
  }

  return analysis;
}

// Function to generate learning suggestions
function generateLearningSuggestions(text) {
  const suggestions = [];
  
  // Vocabulary suggestions
  if (text.length < 50) {
    suggestions.push('Try expanding your response with more details');
  }
  
  // Grammar suggestions
  if (text.includes('I am') || text.includes('you are')) {
    suggestions.push('Great use of present continuous tense!');
  }
  
  // Fluency suggestions
  if (text.split(' ').length > 10) {
    suggestions.push('Excellent fluency! Keep practicing longer conversations');
  }

  return suggestions;
}
