import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { API } from "../api/endpoints";

export const youtubeKeys = {
  tutorials: (mode, boardGame, tutorialVideoId) => [
    "youtube",
    "tutorials",
    mode,
    boardGame || "",
    tutorialVideoId || "",
  ],
};

// "Andá preparado" (TableTutorials) — normaliza los dos modos al mismo
// shape de array de items para que el grid no tenga que diferenciar:
//   - "manual": 1 video puntual (tutorialVideoId) envuelto en array de 1.
//   - "auto":   3 primeros resultados de "Como se juega <boardGame>".
export function useTableTutorialsQuery(mode, boardGame, tutorialVideoId) {
  const enabled =
    (mode === "auto" && !!boardGame?.trim()) ||
    (mode === "manual" && !!tutorialVideoId);
  return useQuery({
    queryKey: youtubeKeys.tutorials(mode, boardGame, tutorialVideoId),
    queryFn: async ({ signal }) => {
      if (mode === "manual") {
        const { data: v } = await axios.get(
          API.youtube.VIDEO(tutorialVideoId),
          { signal },
        );
        if (!v?.videoId) return [];
        return [
          {
            videoId: v.videoId,
            title: v.title || "",
            channel: v.channel || "",
            thumbnail:
              v.thumbnail ||
              `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`,
            duration: v.duration || "",
          },
        ];
      }
      const { data } = await axios.get(API.youtube.COMO_SE_JUEGA, {
        params: { juego: boardGame },
        signal,
      });
      return data?.items || [];
    },
    enabled,
    staleTime: 30 * 60_000,
  });
}
