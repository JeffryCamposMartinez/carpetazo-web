// Formatos compartidos de las herramientas de tienda
export const formatClp = (value) => `$${Math.round(Number(value) || 0).toLocaleString('es-CL')}`;
