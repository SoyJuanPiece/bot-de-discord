const { Events } = require('discord.js');

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        // Ignorar mensajes de bots y del propio cliente
        if (message.author.bot || message.author.system) return;
        
        // Ignorar mensajes sin contenido (solo embeds, archivos, etc.)
        if (!message.content.trim() && message.attachments.size === 0) return;

        const userId = message.author.id;
        const username = message.author.username;

        try {
            // Asegurar que el usuario existe en la base de datos
            client.db.ensureUser(userId, username);

            // Obtener configuración del servidor o usar valores por defecto
            const xpPerMessage = parseInt(process.env.XP_PER_MESSAGE) || 15;

            // Verificar cooldown de XP para este usuario (evitar spam de mensajes)
            const cooldownResult = client.db.checkCooldown(userId, 'xp_message', 60000); // 1 minuto
            
            if (cooldownResult.canUse) {
                // Añadir XP al usuario
                const result = client.db.addXP(userId, xpPerMessage);
                
                // Incrementar contador de mensajes
                client.db.db.prepare(`
                    UPDATE users SET messages_sent = messages_sent + 1 WHERE user_id = ?
                `).run(userId);

                // Si subió de nivel, enviar notificación
                if (result && result.leveledUp) {
                    const { newLevel, oldLevel } = result;
                    
                    // Verificar si hay prefijos desbloqueables por nivel
                    await checkLevelUpRewards(client, userId, newLevel);
                    
                    // Solo notificar en el mismo canal si no es un canal de spam
                    if (!message.channel.name.includes('spam') && !message.channel.name.includes('bot')) {
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
                                url: message.author.displayAvatarURL()
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

                // Establecer cooldown
                client.db.setCooldown(userId, 'xp_message', 60000);
            }

            // Auto-moderación básica (se puede expandir)
            await checkAutoMod(message, client);

        } catch (error) {
            console.error('❌ Error procesando mensaje:', error);
        }
    }
};

/**
 * Verifica recompensas por subir de nivel
 */
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

/**
 * Verificaciones básicas de auto-moderación
 */
async function checkAutoMod(message, client) {
    const content = message.content.toLowerCase();
    
    // Verificar spam de menciones
    if (message.mentions.users.size >= 5) {
        await message.delete().catch(() => {});
        await message.channel.send({
            content: `⚠️ ${message.author}, no se permite mencionar a tantas personas.`,
            allowedMentions: { parse: [] }
        }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
        return;
    }

    // Verificar spam de mayúsculas (más del 70% del mensaje)
    if (content.length > 50) {
        const uppercaseCount = (content.match(/[A-ZÁÉÍÓÚÑ]/g) || []).length;
        const totalLetters = (content.match(/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/g) || []).length;
        
        if (totalLetters > 0 && uppercaseCount / totalLetters > 0.7) {
            await message.delete().catch(() => {});
            await message.channel.send({
                content: `⚠️ ${message.author}, evita escribir en MAYÚSCULAS.`,
                allowedMentions: { parse: [] }
            }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
            return;
        }
    }

    // Aquí se pueden agregar más verificaciones (palabras prohibidas, links, etc.)
}
