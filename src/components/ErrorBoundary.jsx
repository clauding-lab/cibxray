import React from 'react';
import { deriveErrorState } from './ErrorBoundary.js';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return deriveErrorState(error);
  }

  componentDidCatch(error, info) {
    const payload = {
      message: error?.message || 'Unknown error',
      stack: (error?.stack || '').slice(0, 2000),
      componentStack: (info?.componentStack || '').slice(0, 2000),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      timestamp: new Date().toISOString(),
    };
    try {
      fetch('/api/crash-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // Swallow — a crash-in-crash must not cascade.
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{
            maxWidth: 480,
            padding: 32,
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 18, color: '#0f172a' }}>
              Something went wrong
            </h2>
            <p style={{ margin: '0 0 20px', color: '#475569', fontSize: 14, lineHeight: 1.5 }}>
              The page hit an unexpected error and can't continue. A report was sent to the administrator. Please refresh to try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '8px 16px',
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 4,
                color: '#0f172a',
                fontSize: 14,
                cursor: 'pointer',
              }}>
              Refresh
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
