export const initializeApp = () => ({});
export const getAuth = () => ({
  async verifyIdToken(token) {
    if (!token.startsWith('test-')) throw new Error('token de prueba inválido');
    const uid = token.slice(5);
    return { uid, email: `${uid}@test.local`, email_verified: true };
  }
});
