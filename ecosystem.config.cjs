module.exports = {
  apps: [
    {
      name: 'direct-houses',
      cwd: '/home/direct/direct_houses',
      script: 'dist/server.cjs',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 50,
      min_uptime: '10s',
      restart_delay: 3000,
      watch: false,
      max_memory_restart: '800M',
      env: {
        NODE_ENV: 'production',
      },
      time: true,
    },
  ],
};
