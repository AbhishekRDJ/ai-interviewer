"use client";

import React, { Component, ReactNode } from 'react';
import { InterviewErrorHandler, ErrorCode } from '@/lib/utils/errorHandler';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null, errorId: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return {
            hasError: true,
            error,
            errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        const interviewError = InterviewErrorHandler.createError(
            ErrorCode.UNKNOWN_ERROR,
            error,
            { errorInfo, component: 'ErrorBoundary' }
        );

        InterviewErrorHandler.logError(interviewError, 'React Error Boundary');

        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null, errorId: null });
    };

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex flex-col justify-center items-center bg-gradient-to-br from-slate-950 via-red-950 to-slate-950 px-4 min-h-screen">
                    <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl p-8 border border-red-700/50 rounded-2xl w-full max-w-md text-center">
                        <div className="inline-flex justify-center items-center bg-red-500/20 mb-6 rounded-full w-16 h-16">
                            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                        </div>

                        <h2 className="mb-4 font-bold text-white text-xl">Something went wrong</h2>

                        <p className="text-gray-300 mb-6">
                            Something went wrong during your interview session. Don&apos;t worry - your progress has been saved.
                        </p>

                        {this.state.errorId && (
                            <p className="mb-6 font-mono text-gray-500 text-xs">
                                Error ID: {this.state.errorId}
                            </p>
                        )}

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={this.handleRetry}
                                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-lg px-6 py-3 rounded-lg font-semibold text-white transition-all duration-300 hover:scale-105"
                            >
                                Try Again
                            </button>

                            <button
                                onClick={this.handleReload}
                                className="bg-slate-700/50 hover:bg-slate-700/70 px-6 py-3 border border-slate-600/50 rounded-lg font-medium text-gray-300 hover:text-white transition-all duration-300"
                            >
                                Reload Page
                            </button>
                        </div>

                        <div className="mt-6 pt-4 border-slate-700/50 border-t">
                            <p className="mb-2 text-gray-400 text-xs">If this keeps happening:</p>
                            <ul className="space-y-1 text-gray-500 text-xs">
                                <li>• Clear your browser cache</li>
                                <li>• Try a different browser</li>
                                <li>• Contact support with the error ID</li>
                            </ul>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// Higher-order component for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
    Component: React.ComponentType<P>,
    fallback?: ReactNode
) {
    return function WrappedComponent(props: P) {
        return (
            <ErrorBoundary fallback={fallback}>
                <Component {...props} />
            </ErrorBoundary>
        );
    };
}
