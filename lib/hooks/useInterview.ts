// lib/hooks/useInterview.ts
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
// import { InterviewService, InterviewPhase, InterviewState, InterviewCallbacks } from '@/lib/services/InterviewService';
import { InterviewService, InterviewPhase, InterviewState, InterviewCallbacks } from '../../lib/services/InterviewService';
import { interviewConfig } from '@/interview-config/interviewConfig';

export function useInterview() {
    const [phase, setPhase] = useState<InterviewPhase>("idle");
    const [currentQuestion, setCurrentQuestion] = useState<any>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [error, setError] = useState<string>("");
    const [isComplete, setIsComplete] = useState(false);
    const [results, setResults] = useState<any>(null);

    const serviceRef = useRef<InterviewService | null>(null);

    const callbacks: InterviewCallbacks = {
        onStateChange: (state) => {
            setPhase(state.phase);
            setCurrentQuestion(state.currentQuestion);
            setCurrentIndex(state.currentIndex);
        },
        onQuestionAsked: (question) => {
            // Handle question being asked
        },
        onResponseRecorded: (response) => {
            // Could emit events or update additional state here
        },
        onError: setError,
        onComplete: (completionResults) => {
            setIsComplete(true);
            setResults(completionResults);
        }
    };

    useEffect(() => {
        serviceRef.current = new InterviewService(interviewConfig, callbacks);

        return () => {
            if (serviceRef.current) {
                serviceRef.current.stopInterview();
            }
        };
    }, []);

    const startInterview = useCallback(async () => {
        setError("");
        await serviceRef.current?.startInterview();
    }, []);

    const stopInterview = useCallback(async () => {
        await serviceRef.current?.stopInterview();
    }, []);

    const pauseInterview = useCallback(() => {
        serviceRef.current?.pauseInterview();
    }, []);

    const resumeInterview = useCallback(() => {
        serviceRef.current?.resumeInterview();
    }, []);

    const nextQuestion = useCallback(async () => {
        await serviceRef.current?.nextQuestion();
    }, []);

    const recordResponse = useCallback((response: string) => {
        serviceRef.current?.recordResponse(response);
    }, []);

    const getState = useCallback((): InterviewState | null => {
        return serviceRef.current?.getState() || null;
    }, []);

    return {
        // State
        phase,
        currentQuestion,
        currentIndex,
        error,
        isComplete,
        results,

        // Actions
        startInterview,
        stopInterview,
        pauseInterview,
        resumeInterview,
        nextQuestion,
        recordResponse,
        getState,

        // Computed
        totalQuestions: interviewConfig.screening.questions.length,
        isRunning: phase !== "idle" && phase !== "completed",
        isPaused: getState()?.isPaused || false,
    };
}
