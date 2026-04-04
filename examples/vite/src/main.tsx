import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createTypedFetchCache } from "@phumudzo/typed-fetch";
import { TypedFetchProvider } from "@phumudzo/typed-fetch/react";
import "./index.css";
import App from "./App.tsx";

/**
 * Shared cache — passed to every useTypedFetch / useTypedMutation in the tree
 * via TypedFetchProvider.
 *
 * staleTime: 30 s — serve cached result instantly; refetch after 30 s.
 * gcTime:    5 min — remove unused entries after 5 minutes.
 * retry:     3     — retry network errors up to 3 times with exponential back-off.
 */
export const cache = createTypedFetchCache({
  staleTime: 30_000,
  gcTime: 5 * 60_000,
  retry: 3,
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TypedFetchProvider cache={cache}>
      <App />
    </TypedFetchProvider>
  </StrictMode>,
);
