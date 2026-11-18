import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readable = error.message || 'Une erreur inattendue est survenue.';
    try {
      const parsed = JSON.parse(readable);
      if (parsed?.error && parsed?.operationType) {
        readable = `Accès Firestore refusé (${parsed.operationType} sur ${parsed.path || 'ressource'}) : ${parsed.error}`;
      }
    } catch {
      // Message texte standard
    }
    return { hasError: true, message: readable };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[DigiSolia ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 max-w-xl mx-auto my-8 rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-[#163B65] dark:text-white">
                Incident technique intercepté
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {this.state.message}
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#163B65] hover:bg-[#1e4d82] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Réessayer</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
