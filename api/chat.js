// HablaYa! API endpoint for handling chat with OpenAI (Edge-Compatible)
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
    const { messages, model = 'gpt-4-turbo' } = await req.json();

    // Validate input
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid messages array' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Prepare conversation history with system prompt
    const conversationHistory = [
      {
        role: 'system',
        content: `You are HablaYa!, a friendly and patient AI English tutor. Your purpose is to help users practice and improve their English speaking skills through natural conversation.

        Guidelines:
        1. Respond in clear, neutral English suitable for language learners.
        2. Keep responses concise but natural (2-3 sentences typically).
        3. If the user makes grammatical or vocabulary mistakes:
           - First, respond naturally to continue the conversation flow
           - Then politely point out the mistake and provide the correct version
           - Explain simply if needed
        4. Adapt to the user's apparent proficiency level.
        5. Be encouraging and positive.
        6. Occasionally ask follow-up questions to keep the conversation going.
        7. Focus on practical, everyday English usage.
        
        Current time: ${new Date().toLocaleString()}
        `
      },
      ...messages
    ];

    // Call OpenAI API directly from the Edge Function
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model,
        messages: conversationHistory,
        temperature: 0.7,
        max_tokens: 150,
        frequency_penalty: 0.5,
        presence_penalty: 0.5
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API request failed with status ${response.status}`);
    }

    const data = await response.json();
    const aiMessage = data.choices[0]?.message?.content;

    if (!aiMessage) {
      throw new Error('No response from AI');
    }

    return new Response(JSON.stringify({ message: aiMessage }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in chat API:', error);
    return new Response(
      JSON.stringify({ 
        error: 'An error occurred while processing your request',
        details: error.message 
      }), 
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
