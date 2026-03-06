"use client";

import React from "react";

interface ChartErrorBoundaryProps {
  children: React.ReactNode;
  fallbackMessage: string;
}

interface ChartErrorBoundaryState {
  hasError: boolean;
}

export default class ChartErrorBoundary extends React.Component<
  ChartErrorBoundaryProps,
  ChartErrorBoundaryState
> {
  state: ChartErrorBoundaryState = {
    hasError: false
  };

  static getDerivedStateFromError(): ChartErrorBoundaryState {
    return {
      hasError: true
    };
  }

  componentDidCatch(error: unknown) {
    console.error("ChartErrorBoundary", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="rb-panel">
          <p className="rb-muted">{this.props.fallbackMessage}</p>
        </section>
      );
    }

    return this.props.children;
  }
}
