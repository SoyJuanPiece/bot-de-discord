const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const ms = require('ms');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('🔇 Silencia temporalmente a un usuario')
        .addUserOption(option =>
            option
                .setName('usuario')
                .setDescription('Usuario a mutear')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('tiempo')
                .setDescription('Duración del mute (ej: 10m, 1h, 1d)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('motivo')
                .setDescription('Motivo del mute')
                .setRequired(true)
                .setMinLength(5)
                .setMaxLength(200)
        ),
    
    cooldown: 5000,
    
    async execute(interaction, client) {
        // Verificar permisos de moderador
        if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return interaction.reply({
                content: '❌ No tienes permisos para usar este comando.',
                ephemeral: true
            });
        }
        
        const targetUser = interaction.options.getUser('usuario');
        const tiempoStr = interaction.options.getString('tiempo');
        const motivo = interaction.options.getString('motivo');
        
        // Parsear tiempo
        const tiempoMs = ms(tiempoStr);
        
        if (!tiempoMs || tiempoMs < 1000 || tiempoMs > 28 * 24 * 60 * 60 * 1000) {
            return interaction.reply({
                content: '❌ Tiempo inválido. Usa formatos como: `10m`, `1h`, `1d` (máx 28 días)',
                ephemeral: true
            });
        }
        
        // No permitir mute al propio bot o a sí mismo
        if (targetUser.id === client.user.id) {
            return interaction.reply({
                content: '❌ No puedo mutearme a mí mismo.',
                ephemeral: true
            });
        }
        
        if (targetUser.id === interaction.user.id) {
            return interaction.reply({
                content: '❌ No puedes mutearte a ti mismo.',
                ephemeral: true
            });
        }
        
        try {
            const targetMember = await interaction.guild.members.fetch(targetUser.id);
            const moderatorMember = interaction.member;
            
            // Verificar jerarquía de roles
            if (targetMember.roles.highest.position >= moderatorMember.roles.highest.position) {
                return interaction.reply({
                    content: '❌ No puedes mutear a alguien con un rol igual o superior al tuyo.',
                    ephemeral: true
                });
            }
            
            // Verificar si el bot puede mutear
            if (!targetMember.moderatable) {
                return interaction.reply({
                    content: '❌ No tengo permisos para mutear a este usuario.',
                    ephemeral: true
                });
            }
            
            // Aplicar timeout (mute temporal de Discord)
            const durationMs = Math.min(tiempoMs, 28 * 24 * 60 * 60 * 1000); // Máx 28 días por límite de Discord
            await targetMember.timeout(durationMs, motivo);
            
            // Calcular tiempo de expiración
            const expiresAt = Math.floor((Date.now() + durationMs) / 1000);
            
            // Guardar en BD
            client.db.addMute(targetUser.id, interaction.user.tag, motivo, expiresAt);
            
            // Crear embed de respuesta
            const muteEmbed = new EmbedBuilder()
                .setColor(0xff4444)
                .setTitle('🔇 Usuario Muteado')
                .addFields(
                    { name: '👤 Usuario', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                    { name: '👮 Moderador', value: `${interaction.user.tag}`, inline: true },
                    { name: '⏱️ Duración', value: ms(durationMs, { long: true }), inline: true },
                    { name: '📝 Motivo', value: motivo, inline: false },
                    { name: '🕐 Expira', value: `<t:${expiresAt}:R> (<t:${expiresAt}:f>)`, inline: false }
                )
                .setFooter({
                    text: `El usuario será desmuteado automáticamente`
                })
                .setTimestamp();
            
            await interaction.reply({
                embeds: [muteEmbed]
            });
            
            // Enviar DM al usuario
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor(0xff4444)
                    .setTitle('🔇 Has sido muteado')
                    .setDescription(`
**Servidor:** ${interaction.guild.name}
**Duración:** ${ms(durationMs, { long: true })}
**Motivo:** ${motivo}
**Moderador:** ${interaction.user.tag}
                    `)
                    .setFooter({
                        text: 'Podrás volver a hablar cuando expire el mute'
                    })
                    .setTimestamp();
                
                await targetUser.send({ embeds: [dmEmbed] });
            } catch (error) {
                console.log('No se pudo enviar DM al usuario:', error.message);
            }
            
            // Log en canal de logs
            if (process.env.LOG_CHANNEL_ID) {
                const logChannel = await client.channels.fetch(process.env.LOG_CHANNEL_ID).catch(() => null);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setColor(0xff4444)
                        .setTitle('🔇 Nuevo Mute')
                        .addFields(
                            { name: '👤 Usuario', value: `${targetUser.tag}`, inline: true },
                            { name: '👮 Moderador', value: `${interaction.user.tag}`, inline: true },
                            { name: '⏱️ Duración', value: ms(durationMs, { long: true }), inline: true },
                            { name: '📝 Motivo', value: motivo, inline: false }
                        )
                        .setTimestamp();
                    
                    await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
                }
            }
            
        } catch (error) {
            console.error('Error aplicando mute:', error);
            await interaction.reply({
                content: `❌ Error al mutear al usuario: ${error.message}`,
                ephemeral: true
            });
        }
    }
};
