module.exports = {
  apps: [
    {
      name: "envoraicms",
      cwd: "/var/www/envoraicms",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      instances: "max",
      exec_mode: "cluster",
      max_memory_restart: "800M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      error_file: "/var/log/pm2/envoraicms-err.log",
      out_file: "/var/log/pm2/envoraicms-out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
