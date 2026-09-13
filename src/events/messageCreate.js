const { Events } = require('discord.js');

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (message.author.bot || message.system) return;
        if (!message.content.trim() && message.attachments.size === 0) return;
        if (!message.guild) return;

        const userId = message.author.id;
        const username = message.author.username;

        try {
            client.db.ensureUser(userId, username);

            const guildConfig = client.db.getGuildConfig(message.guild.id);
            const xpPerMessage = guildConfig?.xp_per_message || parseInt(process.env.XP_PER_MESSAGE) || 15;

            const cooldownResult = client.db.checkCooldown(userId, 'xp_message', 60000);
            
            if (cooldownResult.canUse) {
                const result = client.db.addXP(userId, xpPerMessage);
                
                client.db._run('UPDATE users SET messages_sent = messages_sent + 1 WHERE user_id = ?', [userId]);

                if (result && result.leveledUp) {
                    const { newLevel, oldLevel } = result;
                    
                    await checkLevelUpRewards(client, userId, newLevel);
                    
                    if (message.channel.name && !message.channel.name.includes('spam') && !message.channel.name.includes('bot')) {
                        const levelUpEmbed = {
                            color: 0x00ff88,
                            title: '🎉 ¡Felicidades! Has subido de nivel',
                            description: `**${message.author.username}** ha alcanzado el **Nivel ${newLevel}**`,
                            fields: [
                                {
                                    name: '📊 Progreso',
                                    value: `Nivel anterior: ${oldLevel}\nNivel actual: ${newLevel}`,
                                    inline: true
                                },
                                {
                                    name: '🎁 Recompensa',
                                    value: '¡Revisa `/prefijos` para ver nuevos prefijos desbloqueados!',
                                    inline: true
                                }
                            ],
                            thumbnail: {
                                url: message.author.displayAvatarURL({ dynamic: true, size: 256 })
                            },
                            footer: {
                                text: 'Sigue activo para ganar más recompensas'
                            }
                        };

                        await message.channel.send({ 
                            content: `🎊 ${message.author} **¡Subiste de nivel!**`,
                            embeds: [levelUpEmbed]
                        });
                    }
                }

                client.db.setCooldown(userId, 'xp_message', 60000);
            }

            if (guildConfig?.auto_mod_enabled !== 0) {
                await checkAutoMod(message, client);
            }

        } catch (error) {
            console.error('❌ Error procesando mensaje:', error.message);
        }
    }
};

async function checkLevelUpRewards(client, userId, newLevel) {
    const prefixesByLevel = {
        5: 'Novato',
        10: 'Aprendiz',
        20: 'Experto',
        30: 'Veterano',
        50: 'Elite',
        75: 'Maestro',
        100: 'Leyenda'
    };

    if (prefixesByLevel[newLevel]) {
        client.db.unlockPrefix(userId, prefixesByLevel[newLevel]);
    }
}

async function checkAutoMod(message, client) {
    const originalContent = message.content;
    const content = originalContent.toLowerCase();
    
    if (message.mentions.users.size >= 5) {
        await message.delete().catch(() => {});
        await message.channel.send({
            content: `⚠️ ${message.author}, no se permite mencionar a tantas personas.`,
            allowedMentions: { parse: [] }
        }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
        return;
    }

    if (originalContent.length > 50) {
        const uppercaseCount = (originalContent.match(/[A-ZÁÉÍÓÚÑ]/g) || []).length;
        const totalLetters = (originalContent.match(/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/g) || []).length;
        
        if (totalLetters > 0 && uppercaseCount / totalLetters > 0.7) {
            await message.delete().catch(() => {});
            await message.channel.send({
                content: `⚠️ ${message.author}, evita escribir en MAYÚSCULAS.`,
                allowedMentions: { parse: [] }
            }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
            return;
        }
    }
}
