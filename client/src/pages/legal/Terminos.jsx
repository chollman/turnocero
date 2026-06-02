import { Link } from "react-router-dom";
import LegalPage from "./LegalPage";
import styles from "./Legal.module.css";

const LAST_UPDATED = "1 de junio de 2026";

export default function Terminos() {
  return (
    <LegalPage
      eyebrow="TÉRMINOS Y CONDICIONES"
      title="Términos y Condiciones de uso"
      updated={LAST_UPDATED}
      docTitle="Términos y Condiciones"
    >
      <div className={styles.intro}>
        <p>
          Estos Términos regulan el uso de <strong>TurnoCero</strong>, una
          plataforma para que la comunidad argentina de juegos de mesa organice
          partidas, comparta momentos y participe de torneos y eventos. Al crear
          una cuenta o usar el sitio, aceptás estos Términos y nuestra{" "}
          <Link to="/privacidad">Política de privacidad</Link>.
        </p>
      </div>

      <h2>1. Quiénes somos</h2>
      <p>
        TurnoCero es un proyecto desarrollado de forma independiente por y para
        la comunidad de juegos de mesa. No es un servicio comercial de una
        empresa registrada; se mantiene a pulmón con el aporte voluntario de sus
        usuarios.
      </p>

      <h2>2. Tu cuenta</h2>
      <ul>
        <li>
          Para usar la mayoría de las funciones necesitás registrarte con un
          email válido y verificarlo mediante el código que te enviamos. También
          podés ingresar con tu cuenta de Google o Facebook.
        </li>
        <li>
          Sos responsable de mantener la confidencialidad de tus credenciales y
          de toda la actividad realizada desde tu cuenta.
        </li>
        <li>
          Debés tener al menos <strong>13 años</strong> para registrarte. Si sos
          menor de edad, te pedimos contar con el consentimiento de tu madre,
          padre o tutor.
        </li>
        <li>
          La información que cargás (nombre, ubicación, datos de contacto) debe
          ser veraz y mantenerse actualizada.
        </li>
      </ul>

      <h2>3. Uso aceptable</h2>
      <p>Al usar TurnoCero te comprometés a no:</p>
      <ul>
        <li>
          Publicar contenido ilegal, ofensivo, discriminatorio, difamatorio o
          que vulnere derechos de terceros.
        </li>
        <li>
          Acosar, suplantar la identidad de otras personas o usar la plataforma
          para estafas o spam.
        </li>
        <li>
          Intentar vulnerar la seguridad del sitio, acceder a datos de otros
          usuarios o interferir con su funcionamiento.
        </li>
        <li>Usar la plataforma con fines comerciales no autorizados.</li>
      </ul>

      <h2>4. Contenido que publicás</h2>
      <p>
        Las mesas, publicaciones de Compartidas, comentarios, imágenes y demás
        contenido que cargás siguen siendo tuyos. Al publicarlos, nos otorgás
        una licencia gratuita y no exclusiva para alojarlos y mostrarlos dentro
        de la plataforma con el fin de prestar el servicio. Sos responsable del
        contenido que publicás y de contar con los derechos necesarios sobre las
        imágenes que subís.
      </p>
      <p>
        Podemos moderar, ocultar o eliminar contenido que infrinja estos
        Términos, sin previo aviso cuando sea necesario.
      </p>

      <h2>5. Mesas, torneos y eventos</h2>
      <ul>
        <li>
          Las mesas, torneos y eventos son organizados por usuarios y
          administradores. TurnoCero facilita el encuentro pero{" "}
          <strong>no organiza ni garantiza</strong> la realización de cada
          partida o evento.
        </li>
        <li>
          Los eventos pueden tener un costo de inscripción. Los pagos se
          coordinan directamente entre los organizadores y los participantes;
          TurnoCero no procesa pagos ni interviene en esas transacciones.
        </li>
        <li>
          La asistencia a encuentros presenciales corre por tu cuenta y riesgo.
          Te recomendamos usar el sentido común al coordinar con personas que no
          conocés.
        </li>
      </ul>

      <h2>6. Integración con BoardGameGeek</h2>
      <p>
        TurnoCero ofrece una integración opcional con BoardGameGeek (BGG) para
        consultar y registrar tus partidas. Si conectás tu cuenta, tus
        credenciales se almacenan cifradas y se usan únicamente para
        comunicarnos con BGG en tu nombre. Podés desconectar la integración
        cuando quieras desde tu perfil. BoardGameGeek es un servicio de terceros
        ajeno a TurnoCero.
      </p>

      <h2>7. Disponibilidad del servicio</h2>
      <p>
        Ofrecemos TurnoCero "tal como está", sin garantías de disponibilidad
        ininterrumpida. Podemos modificar, suspender o discontinuar funciones en
        cualquier momento. Haremos lo posible por avisar los cambios relevantes.
      </p>

      <h2>8. Limitación de responsabilidad</h2>
      <p>
        En la máxima medida permitida por la ley, TurnoCero y sus
        desarrolladores no serán responsables por daños derivados del uso de la
        plataforma, de la interacción con otros usuarios, ni de eventos
        coordinados a través del sitio.
      </p>

      <h2>9. Baja de la cuenta</h2>
      <p>
        Podés solicitar la baja de tu cuenta en cualquier momento. También
        podemos suspender o eliminar cuentas que incumplan estos Términos.
      </p>

      <h2>10. Cambios en estos Términos</h2>
      <p>
        Podemos actualizar estos Términos para reflejar mejoras o cambios
        legales. La versión vigente siempre estará disponible en esta página,
        con su fecha de última actualización.
      </p>

      <h2>11. Contacto</h2>
      <p>
        Ante cualquier duda, escribinos desde la sección{" "}
        <Link to="/colabora">Colaborá</Link> o a través de los canales de
        contacto del sitio.
      </p>

      <p className={styles.crossLink}>
        Ver también: <Link to="/privacidad">Política de privacidad</Link>
      </p>

      <p className={styles.footer}>Gracias por ser parte de TurnoCero.</p>
    </LegalPage>
  );
}
