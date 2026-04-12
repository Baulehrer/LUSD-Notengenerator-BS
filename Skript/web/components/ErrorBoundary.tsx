import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, maxWidth: 600, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
          <h1 style={{ color: '#dc2626' }}>Unerwarteter Fehler</h1>
          <p>Die Anwendung hat einen Fehler festgestellt. Bitte lade die Seite neu.</p>
          <details style={{ marginTop: 16, whiteSpace: 'pre-wrap', fontSize: '0.85rem', color: '#666' }}>
            <summary>Fehlerdetails</summary>
            {this.state.error?.message}
            {this.state.error?.stack}
          </details>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16,
              padding: '8px 16px',
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Seite neu laden
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
