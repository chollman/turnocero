import { Link } from "react-router-dom";
import LegalPage from "./LegalPage";
import styles from "./Legal.module.css";

const LAST_UPDATED = "1 de junio de 2026";

export default function Privacidad() {
  return (
    <LegalPage
      eyebrow="POLÍTICA DE PRIVACIDAD"
      title="Política de privacidad"
      updated={LAST_UPDATED}
      docTitle="Política de privacidad"
    >
      <div className={styles.intro}>
        <p>
          En <strong>TurnoCero</strong> cuidamos tus datos. Esta política
          explica qué información recopilamos, para qué la usamos y qué derechos
          tenés sobre ella. Usar la plataforma implica aceptar esta política, en
          conjunto con nuestros{" "}
          <Link to="/terminos">Términos y Condiciones</Link>.
        </p>
      </div>

      <h2>1. Qué datos recopilamos</h2>
      <ul>
        <li>
          <strong>Datos de cuenta:</strong> email, nombre de usuario, y de forma
          opcional tu nombre, apellido, avatar, datos de contacto (Telegram,
          celular) y ubicación aproximada.
        </li>
        <li>
          <strong>Contenido que publicás:</strong> mesas, publicaciones de
          Compartidas, comentarios, mensajes, imágenes y reacciones.
        </li>
        <li>
          <strong>Ubicación:</strong> si la cargás, usamos las coordenadas para
          mostrarte mesas cercanas y calcular distancias. Es opcional.
        </li>
        <li>
          <strong>Datos de inicio de sesión con terceros:</strong> si ingresás
          con Google o Facebook, recibimos tu email, nombre y foto de perfil
          para crear o vincular tu cuenta.
        </li>
        <li>
          <strong>Credenciales de BoardGameGeek:</strong> solo si conectás la
          integración. Se almacenan <strong>cifradas</strong> y se usan
          únicamente para comunicarnos con BGG en tu nombre.
        </li>
        <li>
          <strong>Datos técnicos:</strong> información mínima necesaria para el
          funcionamiento, como tokens de sesión almacenados en tu dispositivo.
        </li>
      </ul>

      <h2>2. Para qué usamos tus datos</h2>
      <ul>
        <li>Crear y administrar tu cuenta, y verificar tu email.</li>
        <li>
          Prestar las funciones de la plataforma: mesas, torneos, eventos,
          mensajes, amistades y notificaciones.
        </li>
        <li>Mostrarte mesas y contenido relevante según tu ubicación.</li>
        <li>
          Enviarte emails imprescindibles (verificación, recuperación de
          contraseña).
        </li>
        <li>Moderar contenido y mantener la seguridad del sitio.</li>
      </ul>
      <p>
        No vendemos tus datos personales ni los usamos para publicidad de
        terceros.
      </p>

      <h2>3. Visibilidad de tu información</h2>
      <p>
        Parte de tu información es pública dentro de la plataforma según cómo la
        uses:
      </p>
      <ul>
        <li>
          Tu nombre de usuario y avatar son visibles para otros usuarios cuando
          participás de mesas, comentarios o publicaciones.
        </li>
        <li>
          El contenido que publicás respeta el nivel de privacidad que elegís
          (público, solo amigos o privado).
        </li>
        <li>
          Tus mensajes directos solo son visibles para vos y la persona con
          quien chateás.
        </li>
      </ul>

      <h2>4. Proveedores externos</h2>
      <p>
        Para funcionar, TurnoCero se apoya en algunos servicios de terceros que
        procesan ciertos datos por nuestra cuenta:
      </p>
      <ul>
        <li>
          <strong>Cloudinary:</strong> alojamiento de las imágenes que subís.
        </li>
        <li>
          <strong>Resend:</strong> envío de emails transaccionales.
        </li>
        <li>
          <strong>Google y Facebook:</strong> inicio de sesión opcional.
        </li>
        <li>
          <strong>BoardGameGeek:</strong> integración opcional de partidas y
          colección.
        </li>
        <li>
          <strong>Google Maps:</strong> autocompletado y visualización de
          ubicaciones.
        </li>
      </ul>
      <p>
        Cada uno de estos servicios tiene sus propias políticas de privacidad.
      </p>

      <h2>5. Conservación y baja</h2>
      <p>
        Conservamos tus datos mientras tu cuenta esté activa. Si solicitás la
        baja, eliminamos o anonimizamos tu información personal, salvo lo que
        debamos conservar por motivos legales o de seguridad. El contenido
        público asociado a tu cuenta puede mostrarse como de un "Usuario
        eliminado".
      </p>

      <h2>6. Tus derechos</h2>
      <p>
        Podés acceder, rectificar o eliminar tus datos personales en cualquier
        momento desde tu perfil, o solicitándolo a través de los canales de
        contacto del sitio. En Argentina, la Agencia de Acceso a la Información
        Pública es la autoridad de control en materia de protección de datos
        personales (Ley 25.326).
      </p>

      <h2>7. Seguridad</h2>
      <p>
        Tomamos medidas razonables para proteger tu información, incluyendo el
        cifrado de credenciales sensibles y el uso de conexiones seguras. Ningún
        sistema es 100% infalible, por lo que te pedimos cuidar tus credenciales
        de acceso.
      </p>

      <h2>8. Menores de edad</h2>
      <p>
        TurnoCero no está dirigido a menores de 13 años. Si detectamos una
        cuenta creada por un menor sin el consentimiento correspondiente, la
        eliminaremos.
      </p>

      <h2>9. Cambios en esta política</h2>
      <p>
        Podemos actualizar esta política. La versión vigente siempre estará
        disponible en esta página, con su fecha de última actualización.
      </p>

      <p className={styles.crossLink}>
        Ver también: <Link to="/terminos">Términos y Condiciones</Link>
      </p>

      <p className={styles.footer}>Gracias por confiar en TurnoCero.</p>
    </LegalPage>
  );
}
