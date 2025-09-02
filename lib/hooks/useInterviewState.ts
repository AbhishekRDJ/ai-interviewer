"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { interviewConfig } from "@/interview-config/interviewConfig";

export type ResponseRecord = {
  questionId: string;
  questionText: string;
  text: string;
  timestamp: number;
  duration?: number; // Time taken to respond
  wordCount?: number;
  isFollowUp?: boolean;
};

export type InterviewSession = {
  id: string;
  startTime: number;
  endTime?: number;
  totalDuration?: number;
  responses: ResponseRecord[];
  status: "not_started" | "in_progress" | "completed" | "aborted";
};

export function useInterviewState() {
  const questions = interviewConfig.screening.questions;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<ResponseRecord[]>([]);
  const [session, setSession] = useState<InterviewSession>(() => ({
    id: `interview_${Date.now()}`,
    startTime: Date.now(),
    responses: [],
    status: "not_started"
  }));

  const startTimeRef = useRef<number>(Date.now());
  const questionStartTimeRef = useRef<number>(Date.now());

  const currentQuestion = questions[currentIndex] || null;
  const isLastQuestion = currentIndex >= questions.length - 1;

  // Calculate elapsed time from start
  const timeElapsedSec = useMemo(() => {
    return Math.floor((Date.now() - startTimeRef.current) / 1000);
  }, [responses.length, currentIndex]);

  // Calculate time on current question
  const questionTimeElapsed = useMemo(() => {
    return Math.floor((Date.now() - questionStartTimeRef.current) / 1000);
  }, [currentIndex]);

  // Start the interview session
  const startInterview = useCallback(() => {
    const now = Date.now();
    startTimeRef.current = now;
    questionStartTimeRef.current = now;

    setSession(prev => ({
      ...prev,
      startTime: now,
      status: "in_progress"
    }));
  }, []);

  // Record a response to the current question
  const recordResponse = useCallback((text: string, isFollowUp: boolean = false) => {
    if (!currentQuestion) return;

    const now = Date.now();
    const duration = Math.floor((now - questionStartTimeRef.current) / 1000);
    const wordCount = text.trim().split(/\s+/).length;

    const response: ResponseRecord = {
      questionId: currentQuestion.id,
      questionText: currentQuestion.question,
      text: text.trim(),
      timestamp: now,
      duration,
      wordCount,
      isFollowUp
    };

    setResponses(prev => [...prev, response]);

    setSession(prev => ({
      ...prev,
      responses: [...prev.responses, response]
    }));
  }, [currentQuestion]);

  // Move to the next question
  const nextQuestion = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      questionStartTimeRef.current = Date.now();
    }
  }, [currentIndex, questions.length]);

  // Go back to previous question (if needed for admin controls)
  const previousQuestion = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      questionStartTimeRef.current = Date.now();
    }
  }, [currentIndex]);

  // Jump to specific question
  const goToQuestion = useCallback((index: number) => {
    if (index >= 0 && index < questions.length) {
      setCurrentIndex(index);
      questionStartTimeRef.current = Date.now();
    }
  }, [questions.length]);

  // Complete the interview
  const completeInterview = useCallback(() => {
    const now = Date.now();
    const totalDuration = Math.floor((now - startTimeRef.current) / 1000);

    setSession(prev => ({
      ...prev,
      endTime: now,
      totalDuration,
      status: "completed"
    }));
  }, []);

  // Abort the interview
  const abortInterview = useCallback(() => {
    const now = Date.now();
    const totalDuration = Math.floor((now - startTimeRef.current) / 1000);

    setSession(prev => ({
      ...prev,
      endTime: now,
      totalDuration,
      status: "aborted"
    }));
  }, []);

  // Reset interview state
  const resetInterview = useCallback(() => {
    setCurrentIndex(0);
    setResponses([]);
    const now = Date.now();
    startTimeRef.current = now;
    questionStartTimeRef.current = now;

    setSession({
      id: `interview_${now}`,
      startTime: now,
      responses: [],
      status: "not_started"
    });
  }, []);

  // Get responses for current question
  const currentQuestionResponses = useMemo(() => {
    if (!currentQuestion) return [];
    return responses.filter(r => r.questionId === currentQuestion.id);
  }, [currentQuestion, responses]);

  // Get interview progress
  const progress = useMemo(() => {
    const answeredQuestions = new Set(responses.map(r => r.questionId)).size;
    return Math.round((answeredQuestions / questions.length) * 100);
  }, [responses, questions.length]);

  // Calculate interview statistics
  const statistics = useMemo(() => {
    const totalWords = responses.reduce((sum, r) => sum + (r.wordCount || 0), 0);
    const avgWordsPerResponse = responses.length > 0 ? Math.round(totalWords / responses.length) : 0;
    const totalResponseTime = responses.reduce((sum, r) => sum + (r.duration || 0), 0);
    const avgResponseTime = responses.length > 0 ? Math.round(totalResponseTime / responses.length) : 0;

    return {
      totalQuestions: questions.length,
      answeredQuestions: new Set(responses.map(r => r.questionId)).size,
      totalResponses: responses.length,
      totalWords,
      avgWordsPerResponse,
      totalResponseTime,
      avgResponseTime,
      progress
    };
  }, [responses, questions.length, progress]);

  // Auto-start timer when component mounts
  useEffect(() => {
    if (session.status === "not_started") {
      startTimeRef.current = Date.now();
      questionStartTimeRef.current = Date.now();
    }
  }, []);

  // Check if interview should auto-complete based on time
  const maxDuration = interviewConfig.screening.duration * 60; // Convert to seconds
  useEffect(() => {
    if (session.status === "in_progress" && timeElapsedSec >= maxDuration) {
      completeInterview();
    }
  }, [timeElapsedSec, maxDuration, session.status, completeInterview]);

  return {
    // Current state
    currentQuestion,
    currentIndex,
    totalQuestions: questions.length,
    isLastQuestion,

    // Time tracking
    timeElapsedSec,
    questionTimeElapsed,
    maxDuration,
    timeRemaining: Math.max(0, maxDuration - timeElapsedSec),

    // Responses
    responses,
    currentQuestionResponses,

    // Session info
    session,
    progress,
    statistics,

    // Actions
    startInterview,
    recordResponse,
    nextQuestion,
    previousQuestion,
    goToQuestion,
    completeInterview,
    abortInterview,
    resetInterview,

    // Computed values
    canGoNext: currentIndex < questions.length - 1,
    canGoPrevious: currentIndex > 0,
    hasResponded: currentQuestionResponses.length > 0,

    // Interview configuration
    config: interviewConfig.screening,
  };
}