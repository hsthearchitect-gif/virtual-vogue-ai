# 🎨 Virtual Vogue AI

AI-powered virtual try-on web application. Upload your photo, select an outfit, and see yourself wearing it — powered by cutting-edge AI.

![Virtual Vogue AI](https://img.shields.io/badge/Virtual_Vogue-AI-d4a574?style=for-the-badge)

## ✨ Features

- **Upload Photo** — Drag & drop or click to upload your photo
- **Outfit Carousel** — Browse sample outfits with smooth carousel navigation
- **AI Virtual Try-On** — AI generates an image of you wearing the selected outfit
- **Download Result** — Save your AI-generated look
- **Provider Flexibility** — Switch between Replicate and Hugging Face with one env var
- **Cost Optimized** — Image compression, rate limiting, duplicate request prevention

## 🏗️ Architecture

```
virtual-vogue-ai/
├── frontend/         # Next.js (React) — Port 3000
│   ├── src/
│   │   ├── app/          # Pages & layout
│   │   ├── components/   # React components
│   │   └── lib/          # API utilities
│   └── public/outfits/   # Sample outfit images
│
├── backend/          # Express.js — Port 5000
│   ├── routes/           # API routes
│   ├── providers/        # AI provider adapters
│   ├── middleware/        # Rate limiter
│   └── utils/            # Image processing
│
└── .env              # Environment variables
```

## 🚀 Quick Start (Local)

### Prerequisites
- Node.js 18+
- Replicate API token ([get one here](https://replicate.com/account))

### 1. Configure Environment
Edit the `.env` file in the project root:
```env
AI_PROVIDER=replicate
REPLICATE_API_TOKEN=r8_your_actual_token_here
```

### 2. Start Backend
```bash
cd backend
npm install
npm start
```
Backend runs at `http://localhost:5000`

### 3. Start Frontend
Open a new terminal:
```bash
cd frontend
npm install
npm run dev
```
Frontend runs at `http://localhost:3000`

### 4. Use the App
1. Open `http://localhost:3000`
2. Upload your photo
3. Select an outfit from the carousel
4. Click **"Try Now"**
5. Wait for AI to generate your look (~30-60 seconds)
6. Download the result!

## 🤖 AI Providers

### Replicate (Default)
- Uses the `cuuupid/idm-vton` model (IDM-VTON)
- Pay-as-you-go (~$0.02-0.05 per prediction)
- Fast, reliable, well-documented API

### Hugging Face (Free Fallback)
- Uses IDM-VTON Space on Hugging Face
- Free but rate-limited and slower
- May require queue waiting

Switch providers by changing `AI_PROVIDER` in `.env`:
```env
AI_PROVIDER=huggingface
HF_API_TOKEN=hf_your_token_here
```

## 💰 Cost Optimization

| Feature | Savings |
|---------|---------|
| Image compression (sharp) | ~40-60% smaller requests |
| Duplicate request blocking | Prevents accidental double-clicks |
| Rate limiting | 10 req/min per IP |
| Exponential backoff polling | Fewer status check requests |

## 🌐 Deployment

### Frontend → Vercel (Free)
```bash
cd frontend
npx vercel
```
Set environment variable in Vercel dashboard:
```
NEXT_PUBLIC_API_URL=https://your-backend-url.onrender.com
```

### Backend → Render (Free Tier)
1. Push code to GitHub
2. Create a **Web Service** on [Render](https://render.com)
3. Set **Root Directory**: `backend`
4. Set **Build Command**: `npm install`
5. Set **Start Command**: `node server.js`
6. Add environment variables:
   - `REPLICATE_API_TOKEN`
   - `FRONTEND_URL` (your Vercel URL)
   - `AI_PROVIDER` = `replicate`

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (React) |
| Backend | Express.js |
| AI Model | IDM-VTON via Replicate |
| Image Processing | Sharp |
| Styling | CSS Modules + Custom Properties |
| Fonts | Outfit + Inter (Google Fonts) |

## 📝 API Endpoints

### `POST /api/generate`
Create a new virtual try-on prediction.

**Body:**
```json
{
  "humanImage": "data:image/jpeg;base64,...",
  "garmentImage": "/outfits/casual-top.png",
  "garmentDescription": "casual pink blouse top",
  "category": "upper_body"
}
```

**Response:**
```json
{
  "predictionId": "abc123",
  "status": "starting"
}
```

### `GET /api/status/:id`
Poll prediction status.

**Response:**
```json
{
  "predictionId": "abc123",
  "status": "succeeded",
  "output": ["https://...generated-image.png"]
}
```

### `GET /health`
Health check endpoint.

---

Built with ❤️ by Virtual Vogue AI
