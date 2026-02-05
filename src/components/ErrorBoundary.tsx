import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div
          style={{
            padding: 24,
            fontFamily: 'system-ui, sans-serif',
            maxWidth: 560,
            margin: '40px auto',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            color: '#991b1b',
          }}
        >
          <h1 style={{ margin: '0 0 12px', fontSize: 18 }}>Something went wrong</h1>
          <pre
            style={{
              margin: 0,
              fontSize: 13,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {this.state.error.message}
          </pre>
          {this.state.error.stack && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: 'pointer' }}>Stack trace</summary>
              <pre style={{ fontSize: 11, overflow: 'auto', marginTop: 8 }}>{this.state.error.stack}</pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
