const { Events } = require('discord.js');

module.exports = {
    name: Events.MessageUpdate,
    async execute(oldMessage, newMessage, client) {
        if (newMessage.author?.bot || newMessage.system) return;
        if (!newMessage.guild) return;

        const guildConfig = client.db.getGuildConfig(newMessage.guild.id);
        if (guildConfig?.auto_mod_enabled && newMessage.content !== oldMessage.content) {
            if (newMessage.content && newMessage.content.toUpperCase() === newMessage.content && newMessage.content.length > 1) {
                try {
                    await newMessage.delete().catch(() => {});
                    await newMessage.channel.send({ content: `⚠️ <@${newMessage.author.id}>, no se permiten mensajes en MAYÚSCULAS.` }).catch(() => {});
                } catch (error) {
                    console.error('Error en auto-mod (messageUpdate):', error.message);
                }
            }
        }
    }
};
