import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useFacebookSdk } from "../../hooks/useFacebookSdk";
import { getErrorMessage } from "../../utils/getErrorMessage";
import styles from "./Auth.module.css";

const FacebookIcon = () => (
  <svg className={styles.oauthIcon} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#1877F2"
      d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6.02 4.39 11.01 10.13 11.93v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.69.24 2.69.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.08 24 18.09 24 12.07Z"
    />
  </svg>
);

// Botones de login/registro social. Compartido entre Login y Register.
// `onError` deja que el padre muestre el mensaje en su propio .errorBox.
export default function OAuthButtons({ onError }) {
  const { oauthLogin } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const facebook = useFacebookSdk();
  const [busy, setBusy] = useState(false);

  const handleGoogleSuccess = async (credentialResponse) => {
    const credential = credentialResponse?.credential;
    if (!credential) {
      onError?.("No pudimos completar el login con Google");
      return;
    }
    setBusy(true);
    try {
      await oauthLogin("google", { credential });
      navigate("/");
    } catch (err) {
      onError?.(getErrorMessage(err, "Error al iniciar sesión con Google"));
    } finally {
      setBusy(false);
    }
  };

  const handleFacebook = async () => {
    setBusy(true);
    try {
      const accessToken = await facebook.login();
      await oauthLogin("facebook", { accessToken });
      navigate("/");
    } catch (err) {
      // Cancelar el popup no es un error que valga la pena mostrar.
      if (err?.message !== "Login con Facebook cancelado") {
        onError?.(getErrorMessage(err, "Error al iniciar sesión con Facebook"));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.oauthSection}>
      <div className={styles.divider}>o continuá con</div>

      <GoogleLogin
        onSuccess={handleGoogleSuccess}
        onError={() => onError?.("Error al iniciar sesión con Google")}
        theme={theme === "light" ? "outline" : "filled_black"}
        text="continue_with"
        shape="rectangular"
        width="380"
        locale="es"
      />

      {facebook.enabled && (
        <button
          type="button"
          className={styles.oauthBtn}
          onClick={handleFacebook}
          disabled={busy || !facebook.ready}
        >
          <FacebookIcon />
          Continuar con Facebook
        </button>
      )}
    </div>
  );
}
