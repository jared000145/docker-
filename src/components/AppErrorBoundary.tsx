import {recoverNativeRelease} from "@/lib/nativeUpdates";
import { Component, type ErrorInfo, type ReactNode } from 'react';

export default class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Application error', error, info.componentStack); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="min-h-screen grid place-items-center p-6"><section className="max-w-lg rounded-xl border bg-card p-8 space-y-4"><h1 className="text-2xl font-bold">RectorPlus</h1><p>Une erreur empêche l’affichage de cette page. / This page could not be loaded.</p><button className="rounded-lg bg-primary text-primary-foreground px-5 py-3" onClick={() => void recoverNativeRelease()}>Recharger / Reload</button></section></main>;
  }
}
