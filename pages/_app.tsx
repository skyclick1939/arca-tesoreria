import { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { AuthProvider } from '@/context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  // Crear QueryClient dentro del componente para evitar compartir entre requests
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60000, // 1 minuto - datos financieros necesitan frescura
            cacheTime: 300000, // 5 minutos - mantener en caché
            retry: 2, // 2 reintentos (Supabase tiene 99.9% uptime, 3 es excesivo)
            refetchOnWindowFocus: false, // Evitar refetch excesivo
          },
          mutations: {
            retry: 1, // 1 solo reintento para mutaciones
          },
        },
      })
  );

  return (
    <ErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <Component {...pageProps} />
        </QueryClientProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
