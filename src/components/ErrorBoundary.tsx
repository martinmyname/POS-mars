import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

const isChunkLoadError = (err: Error): boolean => {
  const msg = err.message;
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Loading chunk') ||
    msg.includes('Loading CSS chunk') ||
    msg.includes('ChunkLoadError')
  );
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App error:', error, info.componentStack);
  }

  handleRefresh = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const error = this.state.error;
      const isChunk = isChunkLoadError(error);
      return (
        <div
          style={{
            padding: 24,
            fontFamily: 'var(--font-sans)',
            maxWidth: 560,
            margin: '40px auto',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            color: '#991b1b',
          }}
        >
          <h1 style={{ margin: '0 0 12px', fontSize: 18 }}>Something went wrong</h1>
          {isChunk ? (
            <p style={{ margin: '0 0 16px', fontSize: 15 }}>
              A page failed to load, often due to an app update. Refreshing usually fixes this.
            </p>
          ) : (
            <pre
              style={{
                margin: '0 0 16px',
                fontSize: 13,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {error.message}
            </pre>
          )}
          <button
            type="button"
            onClick={this.handleRefresh}
            style={{
              padding: '10px 20px',
              fontSize: 15,
              fontWeight: 600,
              color: '#991b1b',
              background: '#fff',
              border: '1px solid #fecaca',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Refresh page
          </button>
          {!isChunk && error.stack && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: 'pointer' }}>Stack trace</summary>
              <pre style={{ fontSize: 11, overflow: 'auto', marginTop: 8 }}>{error.stack}</pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
