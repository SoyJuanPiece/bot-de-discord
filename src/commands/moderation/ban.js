const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('🔨 Banea permanentemente a un usuario del servidor')
        .addUserOption(option =>
            option
                .setName('usuario')
                .setDescription('Usuario a banear')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('motivo')
                .setDescription('Motivo del baneo')
                .setRequired(true)
                .setMinLength(5)
                .setMaxLength(500)
        )
        .addIntegerOption(option =>
            option
                .setName('dias_mensajes')
                .setDescription('Días de mensajes a eliminar (0-7)')
                .setMinValue(0)
                .setMaxValue(7)
                .setRequired(false)
        ),
    
    cooldown: 15000,
    
    async execute(interaction, client) {
        // Verificar permisos de moderador (Ban Members)
        if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return interaction.reply({
                content: '❌ No tienes permisos para usar este comando.',
                ephemeral: true
            });
        }
        
        const targetUser = interaction.options.getUser('usuario');
        const motivo = interaction.options.getString('motivo');
        const diasMensajes = interaction.options.getInteger('dias_mensajes') || 0;
        
        // No permitir ban al propio bot o a sí mismo
        if (targetUser.id === client.user.id) {
            return interaction.reply({
                content: '❌ No puedo banearme a mí mismo.',
                ephemeral: true
            });
        }
        
        if (targetUser.id === interaction.user.id) {
            return interaction.reply({
                content: '❌ No puedes banearte a ti mismo.',
                ephemeral: true
            });
        }
        
        try {
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            const moderatorMember = interaction.member;
            
            // Verificar jerarquía de roles si el usuario está en el servidor
            if (targetMember) {
                if (targetMember.roles.highest.position >= moderatorMember.roles.highest.position) {
                    return interaction.reply({
                        content: '❌ No puedes banear a alguien con un rol igual o superior al tuyo.',
                        ephemeral: true
                    });
                }
                
                // Verificar si el bot puede banear
                if (!targetMember.bannable) {
                    return interaction.reply({
                        content: '❌ No tengo permisos para banear a este usuario.',
                        ephemeral: true
                    });
                }
            }
            
            // Enviar DM al usuario antes de banearlo (si está en el servidor)
            if (targetMember) {
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle('🔨 Has sido baneado')
                        .setDescription(`
**Servidor:** ${interaction.guild.name}
**Motivo:** ${motivo}
**Moderador:** ${interaction.user.tag}
                        `)
                        .setFooter({
                            text: 'Este es un baneo permanente'
                        })
                        .setTimestamp();
                    
                    await targetUser.send({ embeds: [dmEmbed] });
                } catch (error) {
                    console.log('No se pudo enviar DM al usuario:', error.message);
                }
            }
            
            // Banear al usuario
            await interaction.guild.members.ban(targetUser, {
                deleteMessageSeconds: diasMensajes * 24 * 60 * 60,
                reason: `${motivo} | Moderador: ${interaction.user.tag}`
            });
            
            // Crear embed de respuesta
            const banEmbed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('🔨 Usuario Baneado')
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: '👤 Usuario', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                    { name: '👮 Moderador', value: `${interaction.user.tag}`, inline: true },
                    { name: '🗑️ Mensajes Eliminados', value: `${diasMensajes} días`, inline: true },
                    { name: '📝 Motivo', value: motivo, inline: false }
                )
                .setFooter({
                    text: `Acción realizada por ${interaction.user.username}`
                })
                .setTimestamp();
            
            await interaction.reply({
                embeds: [banEmbed]
            });
            
            // Log en canal de logs
            const logChannelId = client.db.getLogChannel(interaction.guild.id);
            if (logChannelId) {
                const logChannel = await client.channels.fetch(logChannelId).catch(() => null);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle('🔨 Baneo Realizado')
                        .setThumbnail(targetUser.displayAvatarURL())
                        .addFields(
                            { name: '👤 Usuario', value: `${targetUser.tag}`, inline: true },
                            { name: '👮 Moderador', value: `${interaction.user.tag}`, inline: true },
                            { name: '🗑️ Mensajes', value: `${diasMensajes} días eliminados`, inline: true },
                            { name: '📝 Motivo', value: motivo, inline: false }
                        )
                        .setTimestamp();
                    
                    await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
                }
            }
            
        } catch (error) {
            console.error('Error baneando usuario:', error);
            await interaction.reply({
                content: `❌ Error al banear al usuario: ${error.message}`,
                ephemeral: true
            });
        }
    }
};
