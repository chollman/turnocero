import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGoogleLogin } from "@react-oauth/google";
import { useAuth } from "../../context/AuthContext";
import { useFacebookSdk } from "../../hooks/useFacebookSdk";
import { getErrorMessage } from "../../utils/getErrorMessage";
import styles from "./Auth.module.css";

const GoogleIcon = () => (
  <svg className={styles.oauthIcon} viewBox="0 0 48 48" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17Z"
    />
    <path
      fill="#34A853"
      d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46Z"
    />
    <path
      fill="#FBBC05"
      d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7Z"
    />
    <path
      fill="#EA4335"
      d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07Z"
    />
  </svg>
);

const FacebookIcon = () => (
  <svg className={styles.oauthIcon} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#1877F2"
      d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6.02 4.39 11.01 10.13 11.93v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.69.24 2.69.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.08 24 18.09 24 12.07Z"
    />
  </svg>
);

// Botones de login/registro social. Compartido entre Login y Register.
// Ambos botones usan el estilo themed `.oauthBtn` (no el botón oficial de
// Google) para combinar con el resto del sitio. Google va por el flujo
// implícito (useGoogleLogin → access token); el server lo valida.
// `onError` deja que el padre muestre el mensaje en su propio .errorBox.
export default function OAuthButtons({ onError }) {
  const { oauthLogin } = useAuth();
  const navigate = useNavigate();
  const facebook = useFacebookSdk();
  const [busy, setBusy] = useState(false);

  const googleLogin = useGoogleLogin({
    scope: "openid email profile",
    onSuccess: async (tokenResponse) => {
      setBusy(true);
      try {
        await oauthLogin("google", {
          accessToken: tokenResponse.access_token,
        });
        navigate("/");
      } catch (err) {
        onError?.(getErrorMessage(err, "Error al iniciar sesión con Google"));
      } finally {
        setBusy(false);
      }
    },
    onError: () => onError?.("Error al iniciar sesión con Google"),
  });

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

      <button
        type="button"
        className={styles.oauthBtn}
        onClick={() => googleLogin()}
        disabled={busy}
      >
        <GoogleIcon />
        Continuar con Google
      </button>

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
