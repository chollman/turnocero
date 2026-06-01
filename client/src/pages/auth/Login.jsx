import Auth from "./Auth";

// El login y el registro comparten un único componente <Auth>; la ruta decide
// el modo inicial. El toggle segmentado navega entre /login y /register.
export default function Login() {
  return <Auth mode="login" />;
}
