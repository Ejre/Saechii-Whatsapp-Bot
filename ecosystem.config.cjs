module.exports = {
    apps: [{
        name: "whatsapp-bot",
        script: "./index.js",
        watch: true,
        ignore_watch: ["node_modules", "auth_info", "rvo_media", ".git", ".env"],
        max_memory_restart: "500M",
        exec_mode: "fork",
        env: {
            NODE_ENV: "production",
        }
    }]
}
