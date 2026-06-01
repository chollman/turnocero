import { Component } from "react";
import ServerError from "../pages/error/ServerError";

/**
 * Error Boundary global. Captura errores de render que React Router no maneja
 * (el proyecto usa BrowserRouter, sin `errorElement` de data router) y rinde
 * la pantalla 500 full-screen en lugar de un árbol roto / pantalla en blanco.
 *
 * "Reintentar" limpia el estado del boundary para re-montar el árbol; si el
 * error persiste, lo vuelve a capturar. "Ir al inicio" hace reload completo
 * (default de <ServerError>).
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
    this.handleRetry = this.handleRetry.bind(this);
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Punto de enganche para monitoring (Sentry, etc.). En dev queda el log.
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary capturó un error de render:", error, info);
  }

  handleRetry() {
    this.setState({ hasError: false });
  }

  render() {
    if (this.state.hasError) {
      return <ServerError onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}
