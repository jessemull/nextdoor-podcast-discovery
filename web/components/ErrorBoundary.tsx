"use client";

import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
  hasError: boolean;
}

/**
 * Error boundary component for graceful error handling.
 * Catches JavaScript errors in child components and displays a fallback UI.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null, hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error, hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center">
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-6 max-w-md text-center">
            <h2 className="text-xl font-bold text-red-400 mb-2">
              Something went wrong
            </h2>
            <p className="text-gray-400 mb-4">
              An error occurred while rendering this component.
            </p>
            <button
              className="px-4 py-2 bg-red-800 hover:bg-red-700 rounded-md text-sm transition-colors"
              onClick={() => this.setState({ error: null, hasError: false })}
            >
              Try Again
            </button>
            {process.env.NODE_ENV === "development" && this.state.error && (
              <pre className="mt-4 text-left text-xs text-red-300 bg-red-900/30 p-2 rounded overflow-auto">
                {this.state.error.message}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
