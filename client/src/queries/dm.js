import { useQuery } from "@tanstack/react-query";

export const dmKeys = {
  conversations: (userId) => ["dm", "conversations", userId ?? null],
};

// Cache-only, mismo patrón que notifications (ver queries/notifications.js):
// no hay queryFn real. El boot fetch (GET /api/dm) vive como useEffect
// explícito en ChatContext y el listener de socket dm:message escribe
// directo con queryClient.setQueryData — este hook solo suscribe al cache
// para leerlo reactivamente.
export function useDmConversationsQuery(userId) {
  return useQuery({
    queryKey: dmKeys.conversations(userId),
    queryFn: () => ({}),
    enabled: false,
  });
}
