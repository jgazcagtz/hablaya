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
    const { messages, model = 'gpt-4-turbo', userLevel = 'intermediate', learningFocus = 'conversation', sessionData = {} } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid messages array' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Enhanced system prompt for natural English tutoring
    const systemPrompt = `You are HablaYa!, a friendly and encouraging AI English tutor. Your goal is to help learners improve their English through natural conversation.

TEACHING APPROACH:
- **Natural Conversation First**: Engage in normal, flowing conversation like a real tutor
- **Selective Correction**: Only correct significant errors that affect understanding
- **Gentle Guidance**: When you do correct, be encouraging and explain briefly
- **Contextual Learning**: Teach language naturally within conversation topics
- **Encouragement**: Celebrate progress and effort

WHEN TO PROVIDE FEEDBACK:
- Grammar errors that change meaning
- Pronunciation issues that affect clarity
- Vocabulary that could be more natural
- Cultural misunderstandings
- Missed opportunities to use better expressions

FEEDBACK STYLE:
- Keep it brief and encouraging
- Explain the correction naturally
- Offer a better alternative
- Continue the conversation flow

USER LEVEL: ${userLevel}
LEARNING FOCUS: ${learningFocus}
SESSION PROGRESS: ${JSON.stringify(sessionData)}

CURRENT TIME: ${new Date().toLocaleString()}

Remember: Be a supportive conversation partner first, a tutor second. Keep the conversation flowing naturally and only interrupt with corrections when they're truly helpful for learning.`;

    const conversationHistory = [
      {
        role: 'system',
        content: systemPrompt
      },
      ...messages
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model,
        messages: conversationHistory,
        temperature: 0.8,
        max_tokens: 300,
        frequency_penalty: 0.3,
        presence_penalty: 0.3,
        top_p: 0.9
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || 'Chat completion failed');
    }

    const data = await response.json();
    const aiMessage = data.choices[0]?.message?.content;

    if (!aiMessage) {
      throw new Error('No response from AI');
    }

    // Enhanced response structure with metadata
    const enhancedResponse = {
      message: aiMessage,
      metadata: {
        model: model,
        userLevel: userLevel,
        learningFocus: learningFocus,
        timestamp: new Date().toISOString(),
        sessionData: sessionData
      }
    };

    return new Response(JSON.stringify(enhancedResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Chat Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate response',
        details: error.message 
      }), 
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
