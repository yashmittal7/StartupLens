

# ⚡ StartupLens

Validate your startup idea instantly. Get market analysis, SWOT breakdown, competitor insights, and revenue model suggestions — all saved to your account.

🌟 Overview

Building a startup is expensive.
Building the wrong startup is even more expensive.
StartupValidator AI helps founders, students, entrepreneurs, and innovators evaluate business ideas before investing months of effort.
Simply describe your startup idea and the platform generates a detailed validation report including market potential, competitors, revenue opportunities, risks, and execution roadmap.

## What it does

You enter a startup name, industry, and description. The app analyzes it and gives you:

- Executive summary
- Problem and target audience
- Competitor list
- SWOT analysis (Strengths, Weaknesses, Opportunities, Threats)
- Revenue model
- MVP features to build first
- Key risks
- Market score out of 10
- Success probability percentage

---

## Tech used

- **Frontend** — HTML, CSS, JavaScript
- **Backend** — Node.js + Express
- **Database** — MongoDB Atlas
- **Auth** — JWT + bcryptjs
- **AI** — Google Gemini API (Gemini 3.8 Flash)
- **Research** — Gemini Google Search grounding

---

## Folder structure
## 📂 Project Structure

```text
startup-validator/
│
├── backend/
│   ├── middleware/
│   │   └── auth.js
│   │
│   ├── models/
│   │   ├── User.js
│   │   └── Idea.js
│   │
│   ├── routes/
│   │   ├── auth.js
│   │   └── ideas.js
│   │
│   ├── server.js
│   └── .env
│
├── frontend/
│   ├── css/
│   │   └── style.css
│   │
│   ├── js/
│   │   └── api.js
│   │
│   ├── pages/
│   │   ├── register.html
│   │   ├── login.html
│   │   ├── dashboard.html
│   │   ├── validate.html
│   │   ├── result.html
│   │   └── ideas.html
│   │
│   └── index.html
│
├── .gitignore
└── README.md
```
## How to run it locally

**1. Clone the repo**
```bash
git clone https://github.com/YOURUSERNAME/startup-validator.git
cd startup-validator
```

**2. Install dependencies**
```bash
cd backend
npm install
```

**3. Create your `.env` file inside the `backend` folder**
PORT=5005
MONGO_URI=YOUR_MONGODB_URI
JWT_SECRET=YOUR_SECRET_KEY
GEMINI_API_KEY=YOUR_GEMINI_API_KEY

**4. Start the server**
```bash
npm run dev
```

**5. Open the frontend**

Double-click `frontend/index.html` in your file explorer. No server needed for the frontend.

---

## API routes

| Method | Route | What it does |
|--------|-------|--------------|
| POST | `/api/auth/register` | create account |
| POST | `/api/auth/login` | login, returns JWT |
| POST | `/api/ideas` | submit idea, get analysis |
| GET | `/api/ideas` | get all your ideas |
| GET | `/api/ideas/:id` | get one idea |
| DELETE | `/api/ideas/:id` | delete an idea |

---

## Notes

- The `.env` file is in `.gitignore` — never push it to GitHub
- Each submitted startup is analyzed dynamically by Gemini; there are no hardcoded sector-specific reports
- Gemini can use Google Search grounding to research current competitors, market players, trends and other relevant public information
- The Gemini API key stays on the backend and must never be exposed in frontend JavaScript
- All ideas are saved per user in MongoDB

🔮 Future Enhancements
Real-Time Market Research
Startup Pitch Deck Generator
Investor Readiness Score
Business Model Canvas Generator
Financial Forecast Engine
Team Matching Platform
AI Co-Founder Chatbot


👨‍💻 Author

Yash Mittal

B.Tech Information Technology
CAT 2026 Aspirant • Finance Enthusiast • AI Builder


⭐ If you found this project useful, consider starring the repository and contributing to future improvements.
