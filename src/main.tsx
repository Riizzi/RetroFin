import { Component, ErrorInfo, ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('RetroFin Uncaught UI Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-6 text-[#292524] font-mono">
          <div className="max-w-md w-full p-6 bg-white border border-[#E8DFD1] rounded-2xl shadow-lg space-y-4">
            <div className="flex items-center gap-2 text-[#C85A5A]">
              <span className="text-xl">⚠️</span>
              <h2 className="font-bold text-base">Ops! Ocorreu um imprevisto na interface</h2>
            </div>
            <p className="text-xs text-[#78716C] leading-relaxed">
              O aplicativo encontrou um erro temporário durante o carregamento de dados. Seus dados estão seguros na nuvem e no armazenamento local.
            </p>
            <div className="p-3 bg-[#FAF7F2] rounded-lg text-[11px] text-[#A8A29E] overflow-auto max-h-32">
              {this.state.error?.message || 'Erro desconhecido'}
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-2.5 rounded-xl bg-[#292524] text-[#FAF7F2] text-xs font-bold hover:bg-[#44403C] transition"
            >
              Recarregar RetroFin
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
