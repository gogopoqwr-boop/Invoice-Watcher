import React from 'react';

interface State { hasError: boolean }

export class WebGLErrorBoundary extends React.Component<{ children: React.ReactNode; fallback: React.ReactNode }, State> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
