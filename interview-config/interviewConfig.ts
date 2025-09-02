export type InterviewQuestion = {
  id: string;
  question: string;
  maxResponseTime?: number;
  followUpTriggers?: Record<string, string>;
  requiredElements?: string[];
  scoringWeight?: number;
};

export type InterviewConfig = {
  screening: {
    duration: number;
    questions: InterviewQuestion[];
  };
};

export const interviewConfig: InterviewConfig = {
  screening: {
    duration: 10,
    questions: [
      {
        id: "intro",
        question: "Tell me about yourself and why you're interested in sales.",
        maxResponseTime: 90,
        followUpTriggers: {
          no_sales_mention: "What specifically attracts you to sales?",
          vague_response: "Can you be more specific about your experience?",
        },
      },
      {
        id: "cold_calling",
        question: "How would you approach cold calling a prospect?",
        maxResponseTime: 120,
        requiredElements: ["research", "value prop", "objection handling"],
        scoringWeight: 2,
      },
    ],
  },
};


