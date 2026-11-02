import { app } from './app';
import { config } from './config/env';

const server = app.listen(config.port, () => {
  console.log(`[ThreadFlow Backend] Server running on http://localhost:${config.port}`);
  console.log(`[ThreadFlow Backend] API available at http://localhost:${config.port}${config.apiPrefix}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

export { server };
