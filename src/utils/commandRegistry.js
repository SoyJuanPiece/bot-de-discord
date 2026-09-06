const { REST, Routes } = require('discord.js');

/**
 * Registra los comandos slash en el servidor o globalmente
 * @param {Client} client - El cliente de Discord
 */
async function registerSlashCommands(client) {
    const commands = [];
    
    // Construir array de comandos JSON desde los comandos cargados
    for (const [name, command] of client.commands) {
        if (command.data && typeof command.data.toJSON === 'function') {
            commands.push(command.data.toJSON());
        }
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        console.log('🔄 Registrando comandos slash...');

        // Si hay un GUILD_ID configurado, registrar solo en ese servidor (más rápido para desarrollo)
        if (process.env.GUILD_ID) {
            await rest.put(
                Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
                { body: commands }
            );
            console.log(`✅ Comandos registrados en el servidor ${process.env.GUILD_ID}`);
        } else {
            // Registrar globalmente (puede tardar hasta 1 hora en propagarse)
            await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: commands }
            );
            console.log('✅ Comandos registrados globalmente');
        }

        console.log(`📦 Total de comandos registrados: ${commands.length}`);
    } catch (error) {
        console.error('❌ Error al registrar comandos:', error);
    }
}

module.exports = { registerSlashCommands };
