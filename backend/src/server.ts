import { app } from './app';
import { config } from './config/env';

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`[ThreadFlow Backend] Server running on http://localhost:${config.port}`);
  console.log(`[ThreadFlow Backend] LAN access available at http://0.0.0.0:${config.port}`);
  console.log(`[ThreadFlow Backend] API available at http://localhost:${config.port}${config.apiPrefix}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

export { server };
