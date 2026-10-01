const STUB = new URL('./auth-stub.mjs', import.meta.url).href;

export async function resolve(specifier, context, next) {
  if (specifier === 'firebase-admin/auth' || specifier === 'firebase-admin/app') {
    return { url: STUB + '#' + specifier.split('/')[1], shortCircuit: true };
  }
  return next(specifier, context);
}
