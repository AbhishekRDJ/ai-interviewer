// interview-config/interviewConfig.ts

export interface InterviewQuestion {
  id: string;
  question: string;
  maxResponseTime: number; // seconds
  followUpTriggers?: {
    [key: string]: string;
  };
  requiredElements?: string[];
  scoringWeight?: number;
}

export interface InterviewConfig {
  screening: {
    duration: number; // minutes
    questions: InterviewQuestion[];
  };
}

export const interviewConfig: InterviewConfig = {
  screening: {
    duration: 10, // 10 minutes total
    questions: [
      {
        id: "intro",
        question: "Tell me about yourself and why you're interested in a sales development role.",
        maxResponseTime: 90,
        followUpTriggers: {
          "no_sales_mention": "What specifically attracts you to sales?",
          "vague_response": "Can you be more specific about your experience?"
        },
        scoringWeight: 1
      },
      {
        id: "cold_calling",
        question: "How would you approach making a cold call to a potential prospect?",
        maxResponseTime: 120,
        requiredElements: ["research", "value proposition", "objection handling"],
        scoringWeight: 2
      },
      {
        id: "objection_handling",
        question: "A prospect says 'We're not interested right now.' How do you respond?",
        maxResponseTime: 90,
        requiredElements: ["acknowledge", "probe", "provide value"],
        scoringWeight: 2
      },
      {
        id: "qualification",
        question: "What questions would you ask to qualify a lead during your first conversation?",
        maxResponseTime: 120,
        requiredElements: ["budget", "authority", "need", "timing"],
        scoringWeight: 2
      },
      {
        id: "motivation",
        question: "What motivates you in a sales role, and how do you handle rejection?",
        maxResponseTime: 90,
        scoringWeight: 1
      },
      {
        id: "scenario",
        question: "You have 50 leads to contact today, but only have time for 30 calls. How do you prioritize?",
        maxResponseTime: 120,
        requiredElements: ["prioritization criteria", "efficiency", "data-driven approach"],
        scoringWeight: 2
      }
    ]
  }
};