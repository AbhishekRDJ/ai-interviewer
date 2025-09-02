"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { interviewConfig } from "@/interview-config/interviewConfig";

export type ResponseRecord = {
  questionId: string;
  text: string;
  timestamp: number;
};

export function useInterviewState() {
  const questions = interviewConfig.screening.questions;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<ResponseRecord[]>([]);
  const startTimeRef = useRef<number>(Date.now());

  const currentQuestion = questions[currentIndex];

  const timeElapsedSec = useMemo(() => {
    return Math.floor((Date.now() - startTimeRef.current) / 1000);
  }, [responses.length, currentIndex]);

  const recordResponse = useCallback((text: string) => {
    setResponses((prev) => [
      ...prev,
      { questionId: currentQuestion.id, text, timestamp: Date.now() },
    ]);
  }, [currentQuestion?.id]);

  const nextQuestion = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, questions.length - 1));
  }, [questions.length]);

  const isLastQuestion = currentIndex === questions.length - 1;

  return {
    currentQuestion,
    currentIndex,
    totalQuestions: questions.length,
    responses,
    timeElapsedSec,
    isLastQuestion,
    recordResponse,
    nextQuestion,
  };
}


