// HablaYa! API endpoint for handling chat with OpenAI
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, model = 'gpt-4-turbo' } = req.body;

    // Validate input
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages array' });
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

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model,
      messages: conversationHistory,
      temperature: 0.7,
      max_tokens: 150,
      frequency_penalty: 0.5,
      presence_penalty: 0.5
    });

    const aiMessage = completion.choices[0]?.message?.content;

    if (!aiMessage) {
      throw new Error('No response from AI');
    }

    return res.status(200).json({ message: aiMessage });
  } catch (error) {
    console.error('Error in chat API:', error);
    return res.status(500).json({ 
      error: 'An error occurred while processing your request',
      details: error.message 
    });
  }
}

export const config = {
  runtime: 'edge', // Specifies this is an Edge Function
};
