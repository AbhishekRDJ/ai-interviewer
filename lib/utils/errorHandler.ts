// lib/utils/errorHandler.ts
import { InterviewError } from '@/lib/types/interview';

export enum ErrorCode {
    // Speech Recognition Errors
    SPEECH_NOT_SUPPORTED = 'SPEECH_NOT_SUPPORTED',
    SPEECH_RECOGNITION_FAILED = 'SPEECH_RECOGNITION_FAILED',
    SPEECH_SYNTHESIS_FAILED = 'SPEECH_SYNTHESIS_FAILED',

    // API Errors
    LLM_API_ERROR = 'LLM_API_ERROR',
    DAILY_API_ERROR = 'DAILY_API_ERROR',
    DATABASE_ERROR = 'DATABASE_ERROR',

    // Interview Errors
    INTERVIEW_CONFIG_INVALID = 'INTERVIEW_CONFIG_INVALID',
    INTERVIEW_SESSION_NOT_FOUND = 'INTERVIEW_SESSION_NOT_FOUND',
    INTERVIEW_ALREADY_STARTED = 'INTERVIEW_ALREADY_STARTED',

    // Network Errors
    NETWORK_ERROR = 'NETWORK_ERROR',
    TIMEOUT_ERROR = 'TIMEOUT_ERROR',

    // General Errors
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    PERMISSION_DENIED = 'PERMISSION_DENIED',
    UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export class InterviewErrorHandler {
    private static errorMessages: Record<ErrorCode, string> = {
        [ErrorCode.SPEECH_NOT_SUPPORTED]: 'Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.',
        [ErrorCode.SPEECH_RECOGNITION_FAILED]: 'Speech recognition failed. Please check your microphone permissions and try again.',
        [ErrorCode.SPEECH_SYNTHESIS_FAILED]: 'Text-to-speech failed. Please check your browser settings.',
        [ErrorCode.LLM_API_ERROR]: 'AI evaluation service is temporarily unavailable. Please try again.',
        [ErrorCode.DAILY_API_ERROR]: 'Video call service is unavailable. Please refresh and try again.',
        [ErrorCode.DATABASE_ERROR]: 'Database connection failed. Your progress may not be saved.',
        [ErrorCode.INTERVIEW_CONFIG_INVALID]: 'Interview configuration is invalid. Please contact support.',
        [ErrorCode.INTERVIEW_SESSION_NOT_FOUND]: 'Interview session not found. Please start a new interview.',
        [ErrorCode.INTERVIEW_ALREADY_STARTED]: 'Interview is already in progress.',
        [ErrorCode.NETWORK_ERROR]: 'Network connection failed. Please check your internet connection.',
        [ErrorCode.TIMEOUT_ERROR]: 'Request timed out. Please try again.',
        [ErrorCode.VALIDATION_ERROR]: 'Invalid input provided. Please check your data.',
        [ErrorCode.PERMISSION_DENIED]: 'Permission denied. Please check your browser permissions.',
        [ErrorCode.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.'
    };

    private static userFriendlyMessages: Record<ErrorCode, string> = {
        [ErrorCode.SPEECH_NOT_SUPPORTED]: 'Your browser doesn\'t support voice recognition. Try using Chrome or Safari.',
        [ErrorCode.SPEECH_RECOGNITION_FAILED]: 'We couldn\'t hear you clearly. Check your microphone and try speaking again.',
        [ErrorCode.SPEECH_SYNTHESIS_FAILED]: 'Having trouble with audio playback. Try refreshing the page.',
        [ErrorCode.LLM_API_ERROR]: 'Our AI is taking a quick break. Give it a moment and try again.',
        [ErrorCode.DAILY_API_ERROR]: 'Video connection hiccup. Refresh the page to reconnect.',
        [ErrorCode.DATABASE_ERROR]: 'Having trouble saving your progress. Don\'t worry, you can continue.',
        [ErrorCode.INTERVIEW_CONFIG_INVALID]: 'Something\'s not right with the interview setup. We\'re looking into it.',
        [ErrorCode.INTERVIEW_SESSION_NOT_FOUND]: 'Looks like your session expired. Let\'s start fresh!',
        [ErrorCode.INTERVIEW_ALREADY_STARTED]: 'You\'ve already begun this interview.',
        [ErrorCode.NETWORK_ERROR]: 'Internet connection seems spotty. Check your connection and try again.',
        [ErrorCode.TIMEOUT_ERROR]: 'That took longer than expected. Let\'s try once more.',
        [ErrorCode.VALIDATION_ERROR]: 'Something doesn\'t look right with that input.',
        [ErrorCode.PERMISSION_DENIED]: 'We need permission to access your microphone and camera.',
        [ErrorCode.UNKNOWN_ERROR]: 'Oops! Something unexpected happened. Let\'s try that again.'
    };

    public static createError(
        code: ErrorCode,
        originalError?: Error | unknown,
        context?: Record<string, any>
    ): InterviewError {
        return {
            code,
            message: this.errorMessages[code] || this.errorMessages[ErrorCode.UNKNOWN_ERROR],
            details: {
                originalError: originalError instanceof Error ? {
                    name: originalError.name,
                    message: originalError.message,
                    stack: originalError.stack
                } : originalError,
                context
            },
            timestamp: Date.now()
        };
    }

    public static getUserFriendlyMessage(error: InterviewError): string {
        return this.userFriendlyMessages[error.code as ErrorCode] ||
            this.userFriendlyMessages[ErrorCode.UNKNOWN_ERROR];
    }

    public static getRecoveryActions(code: ErrorCode): string[] {
        const recoveryActions: Record<ErrorCode, string[]> = {
            [ErrorCode.SPEECH_NOT_SUPPORTED]: [
                'Switch to Chrome, Edge, or Safari browser',
                'Use the manual text input option'
            ],
            [ErrorCode.SPEECH_RECOGNITION_FAILED]: [
                'Check microphone permissions in browser settings',
                'Ensure microphone is connected and working',
                'Try speaking more clearly and closer to microphone',
                'Refresh the page and try again'
            ],
            [ErrorCode.SPEECH_SYNTHESIS_FAILED]: [
                'Check browser audio settings',
                'Ensure speakers/headphones are connected',
                'Try refreshing the page'
            ],
            [ErrorCode.LLM_API_ERROR]: [
                'Wait a moment and try again',
                'Check your internet connection',
                'Contact support if problem persists'
            ],
            [ErrorCode.DAILY_API_ERROR]: [
                'Refresh the page',
                'Check your internet connection',
                'Try again in a few minutes'
            ],
            [ErrorCode.DATABASE_ERROR]: [
                'Continue with the interview',
                'Your responses are still being processed',
                'Contact support if you need your data recovered'
            ],
            [ErrorCode.NETWORK_ERROR]: [
                'Check your internet connection',
                'Try refreshing the page',
                'Switch to a more stable network if possible'
            ],
            [ErrorCode.PERMISSION_DENIED]: [
                'Click the camera/microphone icon in your browser address bar',
                'Allow access to camera and microphone',
                'Refresh the page after granting permissions'
            ],
            [ErrorCode.UNKNOWN_ERROR]: [
                'Refresh the page and try again',
                'Clear your browser cache',
                'Contact support if the problem continues'
            ]
        };

        return recoveryActions[code] || recoveryActions[ErrorCode.UNKNOWN_ERROR];
    }

    public static logError(error: InterviewError, context?: string): void {
        console.error(`[InterviewError${context ? ` - ${context}` : ''}]:`, {
            code: error.code,
            message: error.message,
            timestamp: new Date(error.timestamp).toISOString(),
            details: error.details
        });

        // In production, you might want to send this to an error tracking service
        if (process.env.NODE_ENV === 'production') {
            // Example: Sentry, LogRocket, etc.
            // errorTrackingService.captureException(error);
        }
    }

    public static handleAsyncError<T>(
        promise: Promise<T>,
        fallbackValue: T,
        errorCode: ErrorCode = ErrorCode.UNKNOWN_ERROR
    ): Promise<T> {
        return promise.catch((error) => {
            const interviewError = this.createError(errorCode, error);
            this.logError(interviewError);
            return fallbackValue;
        });
    }

    public static wrapAsyncFunction<T extends any[], R>(
        fn: (...args: T) => Promise<R>,
        errorCode: ErrorCode = ErrorCode.UNKNOWN_ERROR
    ): (...args: T) => Promise<R | null> {
        return async (...args: T): Promise<R | null> => {
            try {
                return await fn(...args);
            } catch (error) {
                const interviewError = this.createError(errorCode, error);
                this.logError(interviewError);
                return null;
            }
        };
    }

    public static isRetryableError(code: ErrorCode): boolean {
        const retryableErrors = [
            ErrorCode.NETWORK_ERROR,
            ErrorCode.TIMEOUT_ERROR,
            ErrorCode.LLM_API_ERROR,
            ErrorCode.DAILY_API_ERROR,
            ErrorCode.DATABASE_ERROR
        ];
        return retryableErrors.includes(code);
    }

    public static shouldShowToUser(code: ErrorCode): boolean {
        const userVisibleErrors = [
            ErrorCode.SPEECH_NOT_SUPPORTED,
            ErrorCode.SPEECH_RECOGNITION_FAILED,
            ErrorCode.PERMISSION_DENIED,
            ErrorCode.NETWORK_ERROR
        ];
        return userVisibleErrors.includes(code);
    }
}

// Utility functions for common error scenarios
export const handleSpeechError = (error: any) => {
    let code = ErrorCode.SPEECH_RECOGNITION_FAILED;

    if (error?.error === 'not-allowed') {
        code = ErrorCode.PERMISSION_DENIED;
    } else if (error?.error === 'network') {
        code = ErrorCode.NETWORK_ERROR;
    }

    return InterviewErrorHandler.createError(code, error);
};

export const handleAPIError = (error: any, apiType: 'llm' | 'daily' | 'database') => {
    const codeMap = {
        llm: ErrorCode.LLM_API_ERROR,
        daily: ErrorCode.DAILY_API_ERROR,
        database: ErrorCode.DATABASE_ERROR
    };

    return InterviewErrorHandler.createError(codeMap[apiType], error);
};

export const handleNetworkError = (error: any) => {
    const code = error?.name === 'TimeoutError' ?
        ErrorCode.TIMEOUT_ERROR :
        ErrorCode.NETWORK_ERROR;

    return InterviewErrorHandler.createError(code, error);
};
