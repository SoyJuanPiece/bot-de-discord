const { Events } = require('discord.js');
const { registerSlashCommands } = require('../utils/commandRegistry');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log('╔════════════════════════════════════════╗');
        console.log('║         🤖 TITANBOT ONLINE 🤖          ║');
        console.log('╚════════════════════════════════════════╝');
        console.log(`👤 Conectado como: ${client.user.tag}`);
        console.log(`🏠 Servidores: ${client.guilds.cache.size}`);
        console.log(`👥 Usuarios: ${client.users.cache.size}`);
        client.user.setPresence({
            activities: [{ name: '/help | TitanBot v1.0', type: 3 }],
            status: 'online'
        });
        await registerSlashCommands(client);
        console.log('✨ Bot listo para servir a la comunidad');
    }
};
