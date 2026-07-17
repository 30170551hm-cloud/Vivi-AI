const handleLoginSubmit = async (e) => {
  e.preventDefault(); // 👈 Vital para evitar que el navegador recargue la página completa
  try {
    // Llamada a tu adaptador de autenticación
    await firebaseAuthAdapter.login(email, password);
  } catch (error) {
    console.error("Error al iniciar sesión:", error);
  }
};
