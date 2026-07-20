import TestfitTool from "../imports/testfit";
import ErrorBoundary from "../components/ErrorBoundary";

export default function App() {
  return (
    <ErrorBoundary>
      <TestfitTool />
    </ErrorBoundary>
  );
}
