import axios from "axios";
import { API } from "../../api/endpoints";

// Mapea un juego elegido en el buscador BGG ({ id, name, thumbnail, image, year })
// al shape que espera el POST de compartidas ({ bggId, … }). El server re-resuelve
// name/thumbnail/year desde el bggId; solo el bggId es de confianza.
export const toGamePayload = (g) => ({
  bggId: g.id,
  name: g.name,
  thumbnail: g.thumbnail,
  image: g.image,
  year: g.year,
});

// Crea una compartida en DOS pasos: primero el POST de la compartida (sin
// imágenes), y después la subida de cada imagen a /compartidas/:id/images (la
// ruta de creación no acepta multipart). Si algo falla DESPUÉS de crear, borra
// la compartida a medio crear para no dejar huérfanos y re-lanza el error.
//
// Es el flujo que estaba inline en CreateCompartidaForm; extraído para que tanto
// esa pantalla como la sección "Compartí esta partida" del form de BG Watch lo
// compartan (una sola fuente del paso delicado de 2 fases + cleanup).
//
// - payload: cuerpo del POST a /compartidas (category, title, body, boardGames,
//   privacy, community, linkedTable, playResult, …). Campos `undefined` se
//   omiten por axios.
// - files: array de `{ file }` (o `File`) a subir, en orden.
// Devuelve la compartida final (con `images` poblada).
export async function createJuntada({ payload, files = [] }) {
  const { data: created } = await axios.post(API.compartidas.LIST, payload);

  let finalPost = created;
  try {
    for (const img of files) {
      const fd = new FormData();
      fd.append("image", img.file || img);
      const { data: updatedImages } = await axios.post(
        API.compartidas.IMAGES(created._id),
        fd,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      finalPost = { ...finalPost, images: updatedImages };
    }
  } catch (err) {
    // La compartida ya existe pero falló una imagen → la borramos (best-effort)
    // para no dejar un post a medio crear, y propagamos el error original.
    try {
      await axios.delete(API.compartidas.DETAIL(created._id));
    } catch {
      /* ignore cleanup failure */
    }
    throw err;
  }

  return finalPost;
}
