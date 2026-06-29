# Carpetazo 🗂️

Carpetazo es una plataforma web diseñada para vendedores y coleccionistas de Trading Card Games (TCG) como Pokémon, Yu-Gi-Oh!, Magic, entre otros. Permite a los usuarios crear "carpetas" (catálogos virtuales) de sus cartas, administrar su stock y precios, y compartir enlaces públicos para que compradores puedan revisar su inventario fácilmente.

## 🚀 Tecnologías Principales

El proyecto está dividido en dos partes principales: Frontend y Backend.

### Frontend (Carpeta `/frontend`)
- **Framework:** React + Vite
- **Estilos:** Tailwind CSS
- **Autenticación:** Firebase Authentication (Google Login)
- **Despliegue:** Vercel

### Backend (Carpeta `/backend`)
- **Entorno:** Node.js + Express
- **Base de Datos:** Firebase Cloud Firestore (NoSQL)
- **Funcionalidad:** Sincronización de precios, actualización en bloque, limpieza de inventario.

---

## 📂 Estructura del Proyecto

```text
├── backend/                  # Código del servidor Node.js
│   ├── package.json          # Dependencias del servidor
│   ├── server.js             # Punto de entrada de la API
│   └── update_totals.js      # Scripts para sincronizar totales
├── frontend/                 # Aplicación React
│   ├── public/               # Imágenes, iconos y assets estáticos
│   ├── src/                  
│   │   ├── components/       # Componentes reutilizables (Header, Toast, Footer, etc.)
│   │   ├── contexts/         # Contextos de React (AuthContext)
│   │   ├── pages/            # Vistas principales (Dashboard, Explorar, etc.)
│   │   ├── App.jsx           # Enrutamiento de la aplicación
│   │   └── firebase.js       # Configuración e inicialización de Firebase
│   ├── index.html            # Plantilla HTML base
│   ├── package.json          # Dependencias de React
│   ├── tailwind.config.js    # Configuración de estilos
│   └── vite.config.js        # Configuración del bundler
├── .gitignore                # Archivos ignorados por Git
└── README.md                 # Documentación del proyecto
```

## 🛠️ Instalación y Uso Local

Para correr este proyecto en tu máquina local, necesitas tener instalado **Node.js**.

### 1. Clonar el repositorio
```bash
git clone <URL_DEL_REPOSITORIO>
cd "Publicar mis cartas"
```

### 2. Configurar el Frontend
```bash
cd frontend
npm install
npm run dev
```
Esto levantará la interfaz visual en `http://localhost:5173`.

### 3. Configurar el Backend (Opcional para desarrollo local)
```bash
cd ../backend
npm install
node server.js
```
El servidor backend correrá en `http://localhost:3000`.

---

## ✨ Características de la Aplicación

- **Catálogos Personalizables:** Crea múltiples carpetas por categorías (TCG) y colores.
- **Top Destacados:** Sistema de ranking semanal que destaca las carpetas más visitadas públicamente (Optimizada con carga asíncrona concurrente).
- **Sistema de Búsqueda:** Búsqueda rápida de cartas con autocompletado desde la API pública de Pokémon TCG.
- **Gestión de Stock:** Cambios rápidos de precios, aumento/disminución de stock.
- **Vistas Públicas:** Enlaces únicos (Ej: `/c/ID_CARPETA`) para compartir con compradores.

## 📄 Licencia
Este proyecto es privado y todos sus derechos están reservados a sus creadores.
