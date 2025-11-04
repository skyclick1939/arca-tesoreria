import { Html, Head, Main, NextScript } from 'next/document';

/**
 * _document.tsx - Documento HTML base de Next.js
 *
 * Este archivo envuelve toda la aplicación y define la estructura HTML global.
 * Se ejecuta una sola vez en el servidor (SSR).
 *
 * Uso principal: Configurar metadatos globales (favicon, fonts, theme-color)
 */
export default function Document() {
  return (
    <Html lang="es">
      <Head>
        {/*
          FAVICON CONFIGURATION
          Logo de "El Arca" - Moto Club
        */}

        {/* SVG Favicon - Navegadores modernos (Chrome, Firefox, Edge) */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />

        {/*
          Fallback para navegadores que no soportan SVG favicon
          Nota: Para generar favicon.ico desde el SVG, usar herramienta online:
          https://realfavicongenerator.net/
        */}
        <link rel="alternate icon" href="/favicon.svg" type="image/svg+xml" />

        {/* Apple Touch Icon - iOS/macOS Safari */}
        <link rel="apple-touch-icon" href="/favicon.svg" />

        {/*
          Theme Color - Color de barra de navegación en mobile
          Coincide con el verde oscuro del gradiente del logo (#0a3e46)
        */}
        <meta name="theme-color" content="#0a3e46" />

        {/*
          Descripción de la aplicación - Aparece en resultados de búsqueda
        */}
        <meta
          name="description"
          content="El Arca - Sistema de Tesorería para Moto Club. Gestión de deudas, comprobantes de pago y administración de capítulos regionales."
        />

        {/* Autor */}
        <meta name="author" content="El Arca - Moto Club" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
