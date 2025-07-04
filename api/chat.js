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

    // Enhanced system prompt for advanced English tutoring
    const systemPrompt = `You are HablaYa!, an advanced AI English tutor specializing in oral and written production. You are designed to help learners achieve fluency through interactive, personalized instruction.

CORE CAPABILITIES:
1. **Grammar Correction**: Identify and explain grammatical errors with clear explanations
2. **Pronunciation Guidance**: Provide phonetic transcriptions and pronunciation tips
3. **Vocabulary Enhancement**: Suggest synonyms, idioms, and advanced expressions
4. **Conversation Practice**: Engage in natural, contextual dialogues
5. **Writing Improvement**: Help with sentence structure, clarity, and style
6. **Cultural Context**: Explain cultural nuances and appropriate language use

TEACHING METHODOLOGY:
- **Scaffolded Learning**: Start simple, gradually increase complexity
- **Error Correction**: Correct mistakes gently with explanations
- **Positive Reinforcement**: Encourage progress and effort
- **Contextual Learning**: Teach language in meaningful contexts
- **Active Engagement**: Ask follow-up questions to deepen understanding

RESPONSE STRUCTURE:
Always provide responses in this format:
1. **Natural Response**: Your main conversational response
2. **Language Analysis**: Brief grammar/vocabulary feedback (if needed)
3. **Learning Tip**: One helpful tip or suggestion
4. **Practice Suggestion**: A follow-up question or exercise

USER LEVEL: ${userLevel}
LEARNING FOCUS: ${learningFocus}
SESSION PROGRESS: ${JSON.stringify(sessionData)}

CURRENT TIME: ${new Date().toLocaleString()}

Remember: Be encouraging, patient, and adapt your language complexity to the user's level. Focus on practical, everyday English that builds confidence and fluency.`;

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
