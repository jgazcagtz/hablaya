export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const testResults = {
      timestamp: new Date().toISOString(),
      environment: {
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        openAIKeyLength: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0,
        runtime: 'edge'
      },
      status: 'healthy'
    };

    // Test OpenAI API key if available
    if (process.env.OPENAI_API_KEY) {
      try {
        const testResponse = await fetch('https://api.openai.com/v1/models', {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          }
        });
        
        testResults.openaiTest = {
          status: testResponse.status,
          ok: testResponse.ok
        };
      } catch (error) {
        testResults.openaiTest = {
          error: error.message
        };
      }
    }

    return new Response(JSON.stringify(testResults, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: 'Test failed',
        details: error.message 
      }), 
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
} 