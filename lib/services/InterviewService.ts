// lib/services/InterviewService.ts
import { InterviewQuestion, InterviewConfig } from '@/interview-config/interviewConfig';

export type InterviewPhase = "idle" | "speaking" | "listening" | "evaluating" | "wrap_up" | "completed";

export interface InterviewState {
    phase: InterviewPhase;
    currentIndex: number;
    currentQuestion: InterviewQuestion | null;
    responses: Array<{
        questionId: string;
        question: string;
        response: string;
        followUps?: Array<{ question: string; response: string }>;
    }>;
    sessionId: string | null;
    startTime: number;
    isRunning: boolean;
    isPaused: boolean;
}

export interface InterviewCallbacks {
    onPhaseChange: (phase: InterviewPhase) => void;
    onQuestionChange: (question: InterviewQuestion | null, index: number) => void;
    onResponseRecorded: (response: string) => void;
    onError: (error: string) => void;
    onComplete: (results: any) => void;
}

export class InterviewService {
    private state: InterviewState;
    private callbacks: InterviewCallbacks;
    private config: InterviewConfig;
    private speechSynthesis: SpeechSynthesis | null = null;
    private recognition: any = null;

    constructor(config: InterviewConfig, callbacks: InterviewCallbacks) {
        this.config = config;
        this.callbacks = callbacks;
        this.state = this.getInitialState();

        if (typeof window !== 'undefined') {
            this.speechSynthesis = window.speechSynthesis;
        }
    }

    private getInitialState(): InterviewState {
        return {
            phase: "idle",
            currentIndex: 0,
            currentQuestion: this.config.screening.questions[0] || null,
            responses: [],
            sessionId: null,
            startTime: Date.now(),
            isRunning: false,
            isPaused: false,
        };
    }

    public getState(): Readonly<InterviewState> {
        return { ...this.state };
    }

    public async startInterview(): Promise<void> {
        try {
            this.updateState({
                isRunning: true,
                startTime: Date.now(),
                phase: "speaking"
            });

            await this.speakQuestion();
            this.transitionToListening();
        } catch (error) {
            this.handleError(error);
        }
    }

    public async stopInterview(): Promise<void> {
        this.updateState({
            isRunning: false,
            phase: "wrap_up"
        });

        this.stopRecognition();
        if (this.speechSynthesis) {
            this.speechSynthesis.cancel();
        }

        await this.completeInterview();
    }

    public pauseInterview(): void {
        this.updateState({ isPaused: true });
        this.stopRecognition();
        if (this.speechSynthesis) {
            this.speechSynthesis.pause();
        }
    }

    public resumeInterview(): void {
        this.updateState({ isPaused: false });
        if (this.speechSynthesis) {
            this.speechSynthesis.resume();
        }
        if (this.state.phase === "listening") {
            this.startRecognition();
        }
    }

    public async nextQuestion(): Promise<void> {
        const nextIndex = this.state.currentIndex + 1;
        if (nextIndex < this.config.screening.questions.length) {
            const nextQuestion = this.config.screening.questions[nextIndex];
            this.updateState({
                currentIndex: nextIndex,
                currentQuestion: nextQuestion,
                phase: "speaking"
            });

            await this.speakQuestion();
            this.transitionToListening();
        } else {
            await this.stopInterview();
        }
    }

    public recordResponse(response: string): void {
        if (!this.state.currentQuestion) return;

        const responseRecord = {
            questionId: this.state.currentQuestion.id,
            question: this.state.currentQuestion.question,
            response: response.trim(),
        };

        this.updateState({
            responses: [...this.state.responses, responseRecord]
        });

        this.callbacks.onResponseRecorded(response);
    }

    private async speakQuestion(): Promise<void> {
        if (!this.state.currentQuestion || !this.speechSynthesis) return;

        return new Promise<void>((resolve, reject) => {
            const utterance = new SpeechSynthesisUtterance(this.state.currentQuestion!.question);
            utterance.rate = 0.9;
            utterance.pitch = 1;
            utterance.volume = 1;

            utterance.onend = () => resolve();
            utterance.onerror = (event) => reject(new Error(`Speech synthesis error: ${event.error}`));

            this.speechSynthesis!.speak(utterance);
        });
    }

    private transitionToListening(): void {
        this.updateState({ phase: "listening" });
        this.startRecognition();
    }

    private startRecognition(): void {
        if (typeof window === 'undefined') return;

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            this.handleError("Speech recognition not supported");
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = "en-US";

        let finalTranscript = "";

        this.recognition.onresult = (event: any) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    finalTranscript += result[0].transcript + " ";
                }
            }
        };

        this.recognition.onend = () => {
            if (finalTranscript.trim()) {
                this.recordResponse(finalTranscript);
                this.processResponse(finalTranscript);
            }
        };

        this.recognition.onerror = (event: any) => {
            this.handleError(`Speech recognition error: ${event.error}`);
        };

        this.recognition.start();
    }

    private stopRecognition(): void {
        if (this.recognition) {
            this.recognition.stop();
            this.recognition = null;
        }
    }

    private async processResponse(response: string): Promise<void> {
        this.updateState({ phase: "evaluating" });

        try {
            const decision = await this.evaluateResponse(response);

            if (decision.action === "follow_up") {
                await this.handleFollowUp(decision.message);
            } else if (decision.action === "next") {
                await this.nextQuestion();
            } else if (decision.action === "wrap_up") {
                await this.stopInterview();
            }
        } catch (error) {
            this.handleError(error);
        }
    }

    private async evaluateResponse(response: string): Promise<any> {
        const payload = {
            transcript: response,
            state: {
                currentQuestion: this.state.currentQuestion?.question || "",
                timeElapsedSec: Math.floor((Date.now() - this.state.startTime) / 1000),
                questionsRemaining: this.config.screening.questions.length - this.state.currentIndex - 1,
                questionIndex: this.state.currentIndex,
                totalQuestions: this.config.screening.questions.length,
            },
        };

        const res = await fetch("/api/llm", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            throw new Error(`LLM API error: ${res.status}`);
        }

        return await res.json();
    }

    private async handleFollowUp(followUpQuestion: string): Promise<void> {
        this.updateState({ phase: "speaking" });

        const utterance = new SpeechSynthesisUtterance(followUpQuestion);
        await new Promise<void>((resolve) => {
            utterance.onend = () => resolve();
            this.speechSynthesis?.speak(utterance);
        });

        this.transitionToListening();
    }

    private async completeInterview(): Promise<void> {
        this.updateState({ phase: "completed" });

        // Generate final results
        const results = {
            responses: this.state.responses,
            duration: Date.now() - this.state.startTime,
            completedQuestions: this.state.responses.length,
            totalQuestions: this.config.screening.questions.length,
        };

        this.callbacks.onComplete(results);
    }

    private updateState(updates: Partial<InterviewState>): void {
        const prevPhase = this.state.phase;
        const prevQuestion = this.state.currentQuestion;
        const prevIndex = this.state.currentIndex;

        this.state = { ...this.state, ...updates };

        if (updates.phase && updates.phase !== prevPhase) {
            this.callbacks.onPhaseChange(updates.phase);
        }

        if (updates.currentQuestion !== prevQuestion || updates.currentIndex !== prevIndex) {
            this.callbacks.onQuestionChange(this.state.currentQuestion, this.state.currentIndex);
        }
    }

    private handleError(error: any): void {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.callbacks.onError(errorMessage);
        this.updateState({
            isRunning: false,
            phase: "idle"
        });
    }
}
