const express = require('express');
const router = express.Router();
const Idea = require('../models/Idea');
const authMiddleware = require('../middleware/auth');

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent';
const GEMINI_TIMEOUT_MS = 90000;

const analysisSchema = {
  type: 'object',
  properties: {
    executiveSummary: { type: 'string' },
    problemSolved: { type: 'string' },
    targetAudience: { type: 'string' },
    competitors: { type: 'array', items: { type: 'string' } },
    strengths: { type: 'array', items: { type: 'string' } },
    weaknesses: { type: 'array', items: { type: 'string' } },
    opportunities: { type: 'array', items: { type: 'string' } },
    threats: { type: 'array', items: { type: 'string' } },
    revenueModel: { type: 'string' },
    mvpFeatures: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
    marketScore: { type: 'number' },
    successProbability: { type: 'number' },
    scoreRationale: { type: 'string' },
    recommendation: { type: 'string' },
  },
  required: [
    'executiveSummary',
    'problemSolved',
    'targetAudience',
    'competitors',
    'strengths',
    'weaknesses',
    'opportunities',
    'threats',
    'revenueModel',
    'mvpFeatures',
    'risks',
    'marketScore',
    'successProbability',
    'scoreRationale',
    'recommendation',
  ],
};

function buildPrompt(startupName, industry, description) {
  return `
You are a rigorous startup analyst. Evaluate ONE startup idea using the information supplied by the founder.

STARTUP NAME:
${startupName}

INDUSTRY:
${industry}

FOUNDER DESCRIPTION:
${description}

Your job is to produce a realistic, startup-specific validation report.

IMPORTANT RULES:
1. Do not use generic industry boilerplate. Every section must be tied to this exact startup idea.
2. Do not assume the startup is good. Be skeptical and identify weaknesses, execution problems and reasons it could fail.
3. Use Google Search when useful to verify current competitors, market players, regulations, pricing, trends, or recent developments.
4. Competitors must be real companies/products relevant to the exact problem and target user. Do not simply list the biggest companies in the industry.
5. Distinguish between facts supported by research and assumptions/inferences from the founder's description.
6. Do not invent funding, market-size figures, user counts, revenue, partnerships, customers, traction, or regulations. When evidence is unavailable, say so.
7. The marketScore is a 0-10 heuristic assessment of the opportunity, not a factual market metric.
8. The successProbability is a rough scenario estimate based on the information available, NOT a statistically validated probability. Avoid extreme numbers unless strongly justified.
9. Score the idea itself, not the quality/length of the founder's writing.
10. Keep the report useful for an early-stage founder deciding whether to build an MVP.
11. Return ONLY valid JSON matching the supplied schema. No markdown, no code fences.

SCORING GUIDANCE:
- marketScore: consider pain severity, demand, market attractiveness, willingness to pay, competition, differentiation, timing and barriers.
- successProbability: consider product-market fit evidence, differentiation, feasibility, business model, defensibility, go-to-market difficulty, competitive pressure and key execution risks.
- scoreRationale: briefly explain why the scores are what they are and name the 2-3 biggest swing factors.
- recommendation: one of a small set of clear decisions such as "Build MVP", "Validate before building", "Rework positioning", or "Avoid for now", with a concise reason.

Make lists specific and actionable. Prefer 3-5 strong items over many weak ones.
`;
}

function extractGroundingSources(data) {
  const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const seen = new Set();
  const sources = [];

  for (const chunk of chunks) {
    const web = chunk.web;
    if (!web?.uri || seen.has(web.uri)) continue;
    seen.add(web.uri);
    sources.push({
      title: web.title || 'Web source',
      url: web.uri,
    });
  }

  return sources.slice(0, 10);
}

async function generateAnalysis(startupName, industry, description) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured on the server');
  }

  const prompt = buildPrompt(startupName, industry, description);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY,
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: prompt }],
        }],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 5000,
          responseMimeType: 'application/json',
          responseSchema: analysisSchema,
        },
      }),
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Gemini analysis timed out. Please try again.');
    }
    throw new Error('Unable to reach Gemini: ' + err.message);
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json();

  if (!response.ok) {
    console.error('Gemini API error:', JSON.stringify(data));
    const message = data?.error?.message || 'Gemini API request failed';
    throw new Error(message);
  }

  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
  if (!text) {
    throw new Error('Gemini returned an empty analysis');
  }

  let analysis;
  try {
    analysis = JSON.parse(text);
    console.log('AI ANALYSIS:', analysis);
  } catch (err) {
    console.error('Invalid Gemini JSON:', text);
    throw new Error('Gemini returned an invalid analysis format');
  }

  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  analysis.marketScore = Math.round(clamp(analysis.marketScore, 0, 10) * 10) / 10;
  analysis.successProbability = Math.round(clamp(analysis.successProbability, 0, 100));

  const listFields = ['competitors', 'strengths', 'weaknesses', 'opportunities', 'threats', 'mvpFeatures', 'risks'];
  for (const field of listFields) {
    if (!Array.isArray(analysis[field])) analysis[field] = [];
    analysis[field] = analysis[field].filter(item => typeof item === 'string').slice(0, 6);
  }

  const sources = extractGroundingSources(data);
  if (sources.length) analysis.sources = sources;
  analysis.aiModel = 'Gemini 3.8 Flash';
  analysis.generatedAt = new Date().toISOString();

  return analysis;
}

// POST /api/ideas
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { startupName, description, industry } = req.body;

    if (!startupName || !description || !industry) {
      return res.status(400).json({ message: 'Please fill all fields' });
    }

    if (typeof startupName !== 'string' || typeof description !== 'string' || typeof industry !== 'string') {
      return res.status(400).json({ message: 'Invalid input format' });
    }

    if (description.trim().length < 30) {
      return res.status(400).json({ message: 'Description must be at least 30 characters' });
    }

    const analysis = await generateAnalysis(
      startupName.trim(),
      industry.trim(),
      description.trim()
    );

    const idea = new Idea({
      userId: req.user.id,
      startupName: startupName.trim(),
      description: description.trim(),
      industry: industry.trim(),
      analysis,
    });

    await idea.save();
    res.status(201).json(idea);
  } catch (err) {
    console.error('Error creating idea:', err.message);
    const status = err.message.includes('GEMINI_API_KEY') ? 500 : 502;
    res.status(status).json({ message: 'AI analysis failed: ' + err.message });
  }
});

// GET /api/ideas
router.get('/', authMiddleware, async (req, res) => {
  try {
    const ideas = await Idea.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(ideas);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/ideas/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const idea = await Idea.findById(req.params.id);
    if (!idea) return res.status(404).json({ message: 'Idea not found' });
    if (idea.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    res.json(idea);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/ideas/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const idea = await Idea.findById(req.params.id);
    if (!idea) return res.status(404).json({ message: 'Idea not found' });
    if (idea.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    await idea.deleteOne();
    res.json({ message: 'Idea deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
