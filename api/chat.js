export const config = {
  runtime: 'edge',
};

// CEFR Level Detection based on linguistic complexity
const CEFR_LEVELS = {
  B1: {
    name: 'Intermediate',
    vocabulary: ['basic', 'common', 'everyday'],
    grammar: ['simple_past', 'present_perfect', 'conditionals'],
    complexity: 'moderate',
    maxTokens: 150
  },
  B2: {
    name: 'Upper Intermediate',
    vocabulary: ['advanced', 'academic', 'professional'],
    grammar: ['complex_conditionals', 'passive_voice', 'reported_speech'],
    complexity: 'high',
    maxTokens: 200
  },
  C1: {
    name: 'Advanced',
    vocabulary: ['sophisticated', 'idiomatic', 'nuanced'],
    grammar: ['subjunctive', 'inversions', 'complex_structures'],
    complexity: 'very_high',
    maxTokens: 250
  }
};

// Smart model selection based on task type
const MODEL_SELECTION = {
  conversation: 'gpt-4-turbo-preview', // Best for natural conversation
  pronunciation: 'gpt-4-turbo-preview', // Detailed feedback
  grammar: 'gpt-4-turbo-preview', // Complex grammar analysis
  vocabulary: 'gpt-4-turbo-preview', // Rich vocabulary suggestions
  writing: 'gpt-4-turbo-preview', // Written production
  speaking: 'gpt-3.5-turbo' // Faster for real-time speech
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { 
      messages, 
      userLevel = 'intermediate', 
      learningFocus = 'conversation', 
      sessionData = {},
      isVoiceInput = false
    } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid messages array' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Detect user's actual level from their messages
    const detectedLevel = detectUserLevel(messages);
    const effectiveLevel = detectedLevel || userLevel;
    const cefrLevel = getCEFRLevel(effectiveLevel);
    
    // Select optimal model based on task
    const selectedModel = MODEL_SELECTION[learningFocus] || 'gpt-4-turbo-preview';
    
    // Generate context-aware system prompt
    const systemPrompt = generateSystemPrompt({
      level: cefrLevel,
      focus: learningFocus,
      isVoiceInput,
      sessionData,
      detectedLevel
    });

    // Optimize conversation history for token efficiency
    const optimizedHistory = optimizeConversationHistory(messages, cefrLevel.maxTokens);
    
    const conversationHistory = [
      {
        role: 'system',
        content: systemPrompt
      },
      ...optimizedHistory
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: conversationHistory,
        temperature: getOptimalTemperature(learningFocus),
        max_tokens: cefrLevel.maxTokens,
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

    // Enhanced response with learning metadata
    const enhancedResponse = {
      message: aiMessage,
      metadata: {
        model: selectedModel,
        detectedLevel: detectedLevel,
        effectiveLevel: effectiveLevel,
        cefrLevel: cefrLevel.name,
        learningFocus: learningFocus,
        isVoiceInput: isVoiceInput,
        timestamp: new Date().toISOString(),
        sessionData: sessionData,
        tokensUsed: data.usage?.total_tokens || 0
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

// CEFR-based level detection from user messages
function detectUserLevel(messages) {
  const userMessages = messages.filter(m => m.role === 'user');
  if (userMessages.length === 0) return null;

  const lastMessage = userMessages[userMessages.length - 1].content;
  const words = lastMessage.toLowerCase().split(/\s+/);
  
  // Analyze vocabulary complexity
  const complexWords = words.filter(word => 
    word.length > 8 || 
    /[a-z]{3,}ing$|[a-z]{3,}ed$|[a-z]{3,}ly$/.test(word)
  ).length;
  
  // Analyze sentence structure
  const sentences = lastMessage.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const avgSentenceLength = sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length;
  
  // Analyze grammar patterns
  const hasComplexGrammar = /if.*would|had.*would|might.*have|could.*have|should.*have/.test(lastMessage);
  const hasSubjunctive = /were.*to|if.*were/.test(lastMessage);
  
  // Score-based detection
  let score = 0;
  score += complexWords * 2;
  score += avgSentenceLength * 0.5;
  score += hasComplexGrammar ? 10 : 0;
  score += hasSubjunctive ? 15 : 0;
  
  if (score >= 25) return 'advanced';
  if (score >= 15) return 'upper-intermediate';
  return 'intermediate';
}

function getCEFRLevel(level) {
  const levelMap = {
    'intermediate': CEFR_LEVELS.B1,
    'upper-intermediate': CEFR_LEVELS.B2,
    'advanced': CEFR_LEVELS.C1
  };
  return levelMap[level] || CEFR_LEVELS.B1;
}

function generateSystemPrompt({ level, focus, isVoiceInput, sessionData, detectedLevel }) {
  const basePrompt = `You are HablaYa!, an expert English tutor with CEFR certification. You're having a natural conversation with a student at ${level.name} level (${getCEFRCode(level.name)}).

TEACHING PHILOSOPHY:
- Be a supportive conversation partner first, tutor second
- Only correct errors that significantly impact understanding
- Provide gentle, encouraging feedback
- Keep conversation flowing naturally
- Adapt your language complexity to match the student's level

CURRENT CONTEXT:
- Student Level: ${level.name} (${getCEFRCode(level.name)})
- Learning Focus: ${focus}
- Input Type: ${isVoiceInput ? 'Voice' : 'Text'}
- Detected Level: ${detectedLevel ? `${detectedLevel} (auto-detected)` : 'Not detected'}
- Session Progress: ${JSON.stringify(sessionData)}

RESPONSE GUIDELINES:
- Use ${level.complexity} vocabulary and grammar structures
- Keep responses under ${level.maxTokens} tokens
- Be encouraging and supportive
- Provide corrections only when necessary
- Ask follow-up questions to maintain engagement

SPECIFIC INSTRUCTIONS FOR ${focus.toUpperCase()} MODE:`;

  const focusSpecificPrompts = {
    conversation: `
- Engage in natural, flowing dialogue
- Use everyday expressions and idioms
- Ask open-ended questions
- Share cultural insights when relevant
- Keep the conversation engaging and fun`,
    
    pronunciation: `
- Focus on clear, natural speech patterns
- Model correct pronunciation in your responses
- Provide gentle pronunciation tips when needed
- Use phonetic hints for challenging words
- Encourage speaking practice`,
    
    grammar: `
- Naturally incorporate target grammar structures
- Provide brief, clear explanations when correcting
- Use examples to illustrate grammar points
- Encourage experimentation with new structures
- Celebrate correct grammar usage`,
    
    vocabulary: `
- Introduce new words in context
- Provide synonyms and antonyms naturally
- Use collocations and phrasal verbs
- Explain word origins when interesting
- Encourage vocabulary expansion`
  };

  return basePrompt + (focusSpecificPrompts[focus] || focusSpecificPrompts.conversation);
}

function getCEFRCode(levelName) {
  const codes = {
    'Intermediate': 'B1',
    'Upper Intermediate': 'B2', 
    'Advanced': 'C1'
  };
  return codes[levelName] || 'B1';
}

function optimizeConversationHistory(messages, maxTokens) {
  // Keep only the most recent messages to stay within token limits
  const maxMessages = Math.floor(maxTokens / 50); // Rough estimate
  return messages.slice(-maxMessages);
}

function getOptimalTemperature(focus) {
  const temperatures = {
    conversation: 0.8, // More creative for natural conversation
    pronunciation: 0.7, // Balanced for clear speech
    grammar: 0.6, // More focused for grammar instruction
    vocabulary: 0.7, // Creative but controlled for vocabulary
    writing: 0.5, // More focused for writing tasks
    speaking: 0.8 // Natural for speech
  };
  return temperatures[focus] || 0.7;
}
