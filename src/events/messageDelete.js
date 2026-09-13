const { Events } = require('discord.js');

module.exports = {
    name: Events.MessageDelete,
    async execute(message, client) {
        if (message.author?.bot || message.system) return;
        if (!message.guild) return;

        const guildConfig = client.db.getGuildConfig(message.guild.id);
        if (guildConfig?.auto_mod_enabled && guildConfig?.mod_log_channel) {
            const logChannel = await client.channels.fetch(guildConfig.mod_log_channel).catch(() => null);
            if (logChannel) {
                await logChannel.send({ content: `🗑️ Mensaje eliminado en <#${message.channel.id}> por <@${message.author.id}>: ${message.content?.slice(0, 200) || '(sin contenido)'}` }).catch(() => null);
            }
        }
    }
};
