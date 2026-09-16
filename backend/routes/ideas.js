const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const Idea = require('../models/Idea');
const authMiddleware = require('../middleware/auth');
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: {
    message: 'Too many startup analyses. Please try again later.'
  }
});
const {
  generateStartupAnalysis,
} = require('../services/geminiService');

const analysisSchema = {
  type: 'object',
  properties: {
    executiveSummary: {
      type: 'string',
    },

    problemSolved: {
      type: 'string',
    },

    targetAudience: {
      type: 'string',
    },

    competitors: {
      type: 'array',
      items: {
        type: 'string',
      },
    },

    strengths: {
      type: 'array',
      items: {
        type: 'string',
      },
    },

    weaknesses: {
      type: 'array',
      items: {
        type: 'string',
      },
    },

    opportunities: {
      type: 'array',
      items: {
        type: 'string',
      },
    },

    threats: {
      type: 'array',
      items: {
        type: 'string',
      },
    },

    revenueModel: {
      type: 'string',
    },

    mvpFeatures: {
      type: 'array',
      items: {
        type: 'string',
      },
    },

    risks: {
      type: 'array',
      items: {
        type: 'string',
      },
    },

    marketScore: {
      type: 'number',
    },

    successProbability: {
      type: 'number',
    },

    scoreRationale: {
      type: 'string',
    },

    recommendation: {
      type: 'string',
    },
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
You are a rigorous startup analyst evaluating one specific startup idea.

STARTUP NAME:
${startupName}

INDUSTRY:
${industry}

FOUNDER DESCRIPTION:
${description}

Evaluate THIS startup idea rather than giving generic industry advice.

IMPORTANT RULES:

1. Every part of the analysis must be specific to this startup.
2. Do not assume the idea is good. Actively identify weaknesses, risks,
   execution challenges and reasons it could fail.
3. Identify competitors that solve the same or a closely related customer
   problem. Do not simply list famous companies from the industry.
4. Analyze the actual problem, target customer, proposed solution,
   monetization model and likely go-to-market challenges.
5. Do not invent traction, funding, customers, partnerships, revenue,
   market-size figures or other unsupported facts.
6. Clearly distinguish reasonable inference from facts.
7. marketScore must be a heuristic score from 0 to 10.
8. successProbability must be a rough analytical estimate from 0 to 100.
   It is NOT a statistically validated probability.
9. Do not score the quality or length of the founder's writing.
10. Keep recommendations practical for an early-stage founder deciding
    whether to build and test an MVP.
11. Return ONLY valid JSON matching the supplied schema.

SCORING GUIDANCE:

marketScore:
Consider:
- severity of the customer problem
- demand
- willingness to pay
- market attractiveness
- competition
- differentiation
- timing
- barriers to entry

successProbability:
Consider:
- evidence of product-market fit
- differentiation
- technical and operational feasibility
- business model
- go-to-market difficulty
- defensibility
- competitive pressure
- execution risk

scoreRationale:
Explain the reasoning behind the scores and identify the 2-3 biggest
factors that could materially change the outcome.

recommendation:
Choose one practical recommendation such as:
- Build MVP
- Validate before building
- Rework positioning
- Avoid for now

Keep arrays concise and useful. Prefer 3-5 strong items rather than
long generic lists.
`;
}

function sanitizeAnalysis(analysis) {
  const clamp = (value, min, max) => {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return min;
    }

    return Math.max(min, Math.min(max, number));
  };

  analysis.marketScore =
    Math.round(clamp(analysis.marketScore, 0, 10) * 10) / 10;

  analysis.successProbability = Math.round(
    clamp(analysis.successProbability, 0, 100)
  );

  const listFields = [
    'competitors',
    'strengths',
    'weaknesses',
    'opportunities',
    'threats',
    'mvpFeatures',
    'risks',
  ];

  for (const field of listFields) {
    if (!Array.isArray(analysis[field])) {
      analysis[field] = [];
    }

    analysis[field] = analysis[field]
      .filter((item) => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, 6);
  }

  return analysis;
}

// POST /api/ideas
router.post('/', authMiddleware, aiLimiter, async (req, res) => {
  try {
    const {
      startupName,
      description,
      industry,
    } = req.body;

    if (!startupName || !description || !industry) {
      return res.status(400).json({
        message: 'Please fill all fields',
      });
    }

    if (
      typeof startupName !== 'string' ||
      typeof description !== 'string' ||
      typeof industry !== 'string'
    ) {
      return res.status(400).json({
        message: 'Invalid input format',
      });
    }

    const cleanStartupName = startupName.trim();
    const cleanDescription = description.trim();
    const cleanIndustry = industry.trim();

    if (cleanStartupName.length < 2) {
      return res.status(400).json({
        message: 'Startup name must be at least 2 characters',
      });
    }

    if (cleanStartupName.length > 100) {
      return res.status(400).json({
        message: 'Startup name is too long',
      });
    }

    if (cleanIndustry.length < 2) {
      return res.status(400).json({
        message: 'Industry is required',
      });
    }

    if (cleanDescription.length < 30) {
      return res.status(400).json({
        message: 'Description must be at least 30 characters',
      });
    }

    if (cleanDescription.length > 5000) {
      return res.status(400).json({
        message: 'Description must be less than 5000 characters',
      });
    }

    const prompt = buildPrompt(
      cleanStartupName,
      cleanIndustry,
      cleanDescription
    );

    const analysis = await generateStartupAnalysis(
      prompt,
      analysisSchema
    );

    const sanitizedAnalysis = sanitizeAnalysis(analysis);

    sanitizedAnalysis.aiModel = 'Gemini 3.6 Flash';
    sanitizedAnalysis.generatedAt = new Date().toISOString();

    const idea = new Idea({
      userId: req.user.id,
      startupName: cleanStartupName,
      description: cleanDescription,
      industry: cleanIndustry,
      analysis: sanitizedAnalysis,
    });

    await idea.save();

    res.status(201).json(idea);
  } catch (err) {
    console.error('Error creating idea:', err.message);

    const status = err.message.includes('GEMINI_API_KEY')
      ? 500
      : 502;

    res.status(status).json({
      message: 'AI analysis failed: ' + err.message,
    });
  }
});

// GET /api/ideas
router.get('/', authMiddleware, async (req, res) => {
  try {
    const ideas = await Idea.find({
      userId: req.user.id,
    }).sort({
      createdAt: -1,
    });

    res.json(ideas);
  } catch (err) {
    console.error('Error fetching ideas:', err.message);

    res.status(500).json({
      message: 'Server error',
    });
  }
});

// GET /api/ideas/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const idea = await Idea.findById(req.params.id);

    if (!idea) {
      return res.status(404).json({
        message: 'Idea not found',
      });
    }

    if (idea.userId.toString() !== req.user.id) {
      return res.status(403).json({
        message: 'Not authorized',
      });
    }

    res.json(idea);
  } catch (err) {
    console.error('Error fetching idea:', err.message);

    res.status(500).json({
      message: 'Server error',
    });
  }
});

// DELETE /api/ideas/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const idea = await Idea.findById(req.params.id);

    if (!idea) {
      return res.status(404).json({
        message: 'Idea not found',
      });
    }

    if (idea.userId.toString() !== req.user.id) {
      return res.status(403).json({
        message: 'Not authorized',
      });
    }

    await idea.deleteOne();

    res.json({
      message: 'Idea deleted successfully',
    });
  } catch (err) {
    console.error('Error deleting idea:', err.message);

    res.status(500).json({
      message: 'Server error',
    });
  }
});

module.exports = router;
