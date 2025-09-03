# AI Interview Prototype
## https://ai-interviewer-weld.vercel.app/

# Live Demo:
## https://www.loom.com/share/1333522124f64a1a822d84fd0232e053?sid=ba1d5c17-6a6b-4f69-beab-e1456c3030cc

An AI-powered interview system that conducts real-time video interviews with speech recognition, natural language processing, and automated scoring.

## Features

- 🎥 **Video Calls**: Powered by Daily.co for secure video communication
- 🎤 **Speech Recognition**: Real-time transcription using Web Speech API
- 🤖 **AI Interviewer**: Google Gemini AI conducts intelligent follow-up questions
- 📊 **Automated Scoring**: AI-powered evaluation and feedback
- 📱 **Responsive Design**: Modern UI with dark theme and smooth animations

## Prerequisites

Before running this application, you'll need:

1. **Daily.co Account**: Sign up at [daily.co](https://daily.co) to get API credentials
2. **Google AI Studio**: Get a Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

## Environment Setup

Create a `.env.local` file in the root directory with the following variables:

```bash
# Daily.co API Configuration
DAILY_API_KEY=your_daily_api_key_here
NEXT_PUBLIC_DAILY_DOMAIN=your_daily_domain.daily.co

# Google Gemini AI Configuration
GEMINI_API_KEY=your_gemini_api_key_here

# Next.js Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Getting Started

1. **Install Dependencies**:
```bash
npm install
```

2. **Set up Environment Variables**:
   - Copy the example above to `.env.local`
   - Fill in your actual API keys

3. **Run the Development Server**:
```bash
npm run dev
```

4. **Open the Application**:
   - Navigate to [http://localhost:3000](http://localhost:3000)
   - Click "Start Interview" to begin

## How It Works

1. **Room Creation**: The app creates a secure Daily.co room for video communication
2. **AI Interviewer**: Gemini AI asks questions and evaluates responses in real-time
3. **Speech Recognition**: Browser's Web Speech API transcribes user responses
4. **Follow-up Questions**: AI asks intelligent follow-ups based on response quality
5. **Scoring**: Final evaluation provides detailed feedback and recommendations

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
