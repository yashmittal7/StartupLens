const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent';

const GEMINI_TIMEOUT_MS = 90000;

async function generateStartupAnalysis(prompt, analysisSchema) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured on the server');
  }

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, GEMINI_TIMEOUT_MS);

  try {
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY,
      },

      signal: controller.signal,

      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],

        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 5000,
          responseMimeType: 'application/json',
          responseSchema: analysisSchema,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini API error:', JSON.stringify(data));

      const message =
        data?.error?.message || 'Gemini API request failed';

      throw new Error(message);
    }

    const text = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '')
      .join('')
      .trim();

    if (!text) {
      throw new Error('Gemini returned an empty analysis');
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      console.error('Invalid Gemini JSON:', text);
      throw new Error('Gemini returned an invalid analysis format');
    }

  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Gemini analysis timed out. Please try again.');
    }

    throw error;

  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  generateStartupAnalysis,
};