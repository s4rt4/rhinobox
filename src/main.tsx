import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './styles.css';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <MantineProvider defaultColorScheme="dark">
        <Notifications position="top-right" />
        <App />
      </MantineProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
