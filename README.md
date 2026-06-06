# TaskLeaf — PWA de Tareas

TaskLeaf es una aplicación web progresiva para gestionar tareas, desarrollada con **React + TypeScript + Vite**.

Permite crear, completar y eliminar tareas, con almacenamiento local mediante **IndexedDB** y sincronización con **Firebase Firestore**.

## Demo

URL del proyecto:

```txt
https://taskleaf.netlify.app
```

## Características principales

- Crear tareas con título, descripción, prioridad y fecha.
- Marcar tareas como completadas.
- Eliminar tareas.
- Ver resumen de tareas pendientes y completadas.
- Indicador de conexión online/offline.
- Almacenamiento local con IndexedDB.
- Sincronización con Firebase Firestore.
- Diseño responsive.

## Tecnologías utilizadas

- React
- TypeScript
- Vite
- CSS
- IndexedDB
- Firebase Firestore
- Service Worker
- Netlify

## Instalación

Clona el repositorio:

```bash
git clone https://github.com/rociogfh/TakLeaf-PWA.git
```

Entra a la carpeta del proyecto:

```bash
cd TaskLeaf-PWA
```

Instala las dependencias:

```bash
npm install
```

## Variables de entorno

Crea un archivo `.env` en la raíz del proyecto con tus variables de Firebase:

```env
VITE_FB_API_KEY=tu_api_key
VITE_FB_AUTH_DOMAIN=tu_auth_domain
VITE_FB_PROJECT_ID=tu_project_id
VITE_FB_STORAGE_BUCKET=tu_storage_bucket
VITE_FB_MESSAGING_SENDER_ID=tu_sender_id
VITE_FB_APP_ID=tu_app_id
VITE_FB_MEASUREMENT_ID=tu_measurement_id
```

## Ejecutar en desarrollo

```bash
npm run dev
```

## Build para producción

```bash
npm run build
```

## Licencia

Proyecto desarrollado con fines académicos y de portafolio.
