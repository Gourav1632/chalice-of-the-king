module.exports = {
  apps: [
    {
      name: 'chalice-backend',
      script: './backend/dist/index.js',
      instances: 2, // or 'max' for all CPU cores
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3001,
      },
      // Auto-restart on file changes in development
      watch: false,
      // Restart on crash
      autorestart: true,
      // Max memory before restart
      max_memory_restart: '500M',
      // Error log location
      error_file: './backend/logs/pm2-error.log',
      // Combined log location
      out_file: './backend/logs/pm2-out.log',
      // Merge logs from all instances
      merge_logs: true,
      // Timestamp in logs
      time: true,
      // Wait for graceful shutdown
      kill_timeout: 5000,
      // Wait before restarting
      wait_ready: true,
      listen_timeout: 10000,
    },
  ],
};
