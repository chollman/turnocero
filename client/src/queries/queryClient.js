import { QueryClient } from '@tanstack/react-query';

// 4xx are the server telling us the request itself is wrong ({ message }
// contract, see CLAUDE.md "Server error format") — retrying won't help.
// Only network errors / 5xx are worth a couple of retries.
const shouldRetry = (failureCount, error) => {
  const status = error?.response?.status;
  if (status && status >= 400 && status < 500) return false;
  return failureCount < 2;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: shouldRetry,
    },
    mutations: {
      retry: false,
    },
  },
});
