// lib/types/interview.ts

export interface InterviewQuestion {
    id: string;
    question: string;
    maxResponseTime: number;
    followUpTriggers?: Record<string, string>;
    requiredElements?: string[];
    scoringWeight?: number;
    category?: 'technical' | 'behavioral' | 'situational' | 'general';
}

export interface InterviewConfig {
    id: string;
    name: string;
    description?: string;
    duration: number; // minutes
    questions: InterviewQuestion[];
    passingScore?: number;
    categories?: string[];
}

export interface InterviewResponse {
    questionId: string;
    questionText: string;
    response: string;
    timestamp: number;
    duration?: number;
    wordCount?: number;
    isFollowUp?: boolean;
    confidence?: number;
}

export interface InterviewSession {
    id: string;
    userId?: string;
    configId: string;
    startTime: number;
    endTime?: number;
    status: 'not_started' | 'in_progress' | 'completed' | 'aborted';
    responses: InterviewResponse[];
    roomUrl?: string;
    recordingUrl?: string;
    metadata?: Record<string, any>;
}

export interface ScoringResult {
    overallScore: number;
    categoryScores: Record<string, number>;
    questionScores: Array<{
        questionId: string;
        question: string;
        response: string;
        score: number;
        feedback: string;
        elements?: Record<string, boolean>;
    }>;
    summary: string;
    recommendations: string[];
    decision: 'hire' | 'maybe' | 'no_hire';
    strengths: string[];
    improvements: string[];
}

export interface LLMDecision {
    responseQuality: 'complete' | 'incomplete' | 'off-topic';
    action: 'follow_up' | 'next' | 'wrap_up';
    message: string;
    reasoning?: string;
    confidence?: number;
}

export interface SpeechRecognitionResult {
    transcript: string;
    confidence: number;
    isFinal: boolean;
}

export interface VideoCallAPI {
    startRecording: () => Promise<void>;
    stopRecording: () => Promise<void>;
    getRecordingUrl?: () => Promise<string | null>;
}

export type InterviewPhase =
    | 'idle'
    | 'speaking'
    | 'listening'
    | 'evaluating'
    | 'wrap_up'
    | 'completed';

export interface InterviewError {
    code: string;
    message: string;
    details?: any;
    timestamp: number;
}

// API Response Types
export interface APIResponse<T = any> {
    success: boolean;
    data?: T;
    error?: InterviewError;
    message?: string;
}

export interface CreateRoomResponse {
    room: {
        url: string;
        name: string;
        id: string;
    };
}

export interface InterviewAnalytics {
    totalDuration: number;
    averageResponseTime: number;
    totalWords: number;
    questionsCompleted: number;
    pauseCount: number;
    errorCount: number;
}

// Event Types for Interview System
export type InterviewEvent =
    | { type: 'INTERVIEW_STARTED'; payload: { sessionId: string } }
    | { type: 'QUESTION_ASKED'; payload: { questionId: string; question: string } }
    | { type: 'RESPONSE_RECORDED'; payload: { response: InterviewResponse } }
    | { type: 'PHASE_CHANGED'; payload: { from: InterviewPhase; to: InterviewPhase } }
    | { type: 'ERROR_OCCURRED'; payload: InterviewError }
    | { type: 'INTERVIEW_COMPLETED'; payload: { results: ScoringResult } };

// Configuration Types
export interface InterviewSettings {
    autoAdvance: boolean;
    maxSilenceDuration: number;
    speechRecognitionLanguage: string;
    voiceSettings: {
        rate: number;
        pitch: number;
        volume: number;
    };
    recordingEnabled: boolean;
    transcriptionEnabled: boolean;
}

export interface InterviewTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    estimatedDuration: number;
    questions: InterviewQuestion[];
    tags: string[];
    isActive: boolean;
    createdAt: number;
    updatedAt: number;
}
