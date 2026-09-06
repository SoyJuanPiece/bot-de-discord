const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('👢 Expulsa a un usuario del servidor')
        .addUserOption(option =>
            option
                .setName('usuario')
                .setDescription('Usuario a expulsar')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('motivo')
                .setDescription('Motivo de la expulsión')
                .setRequired(true)
                .setMinLength(5)
                .setMaxLength(500)
        ),
    
    cooldown: 10000,
    
    async execute(interaction, client) {
        // Verificar permisos de moderador (Kick Members)
        if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
            return interaction.reply({
                content: '❌ No tienes permisos para usar este comando.',
                ephemeral: true
            });
        }
        
        const targetUser = interaction.options.getUser('usuario');
        const motivo = interaction.options.getString('motivo');
        
        // No permitir kick al propio bot o a sí mismo
        if (targetUser.id === client.user.id) {
            return interaction.reply({
                content: '❌ No puedo expulsarme a mí mismo.',
                ephemeral: true
            });
        }
        
        if (targetUser.id === interaction.user.id) {
            return interaction.reply({
                content: '❌ No puedes expulsarte a ti mismo.',
                ephemeral: true
            });
        }
        
        try {
            const targetMember = await interaction.guild.members.fetch(targetUser.id);
            const moderatorMember = interaction.member;
            
            // Verificar jerarquía de roles
            if (targetMember.roles.highest.position >= moderatorMember.roles.highest.position) {
                return interaction.reply({
                    content: '❌ No puedes expulsar a alguien con un rol igual o superior al tuyo.',
                    ephemeral: true
                });
            }
            
            // Verificar si el bot puede kickear
            if (!targetMember.kickable) {
                return interaction.reply({
                    content: '❌ No tengo permisos para expulsar a este usuario.',
                    ephemeral: true
                });
            }
            
            // Enviar DM al usuario antes de expulsarlo
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor(0xff4444)
                    .setTitle('👢 Has sido expulsado')
                    .setDescription(`
**Servidor:** ${interaction.guild.name}
**Motivo:** ${motivo}
**Moderador:** ${interaction.user.tag}
                    `)
                    .setFooter({
                        text: 'Puedes volver a unirte si recibes una nueva invitación'
                    })
                    .setTimestamp();
                
                await targetUser.send({ embeds: [dmEmbed] });
            } catch (error) {
                console.log('No se pudo enviar DM al usuario:', error.message);
            }
            
            // Expulsar al usuario
            await targetMember.kick(`${motivo} | Moderador: ${interaction.user.tag}`);
            
            // Crear embed de respuesta
            const kickEmbed = new EmbedBuilder()
                .setColor(0xff6600)
                .setTitle('👢 Usuario Expulsado')
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: '👤 Usuario', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                    { name: '👮 Moderador', value: `${interaction.user.tag}`, inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '📝 Motivo', value: motivo, inline: false }
                )
                .setFooter({
                    text: `Acción realizada por ${interaction.user.username}`
                })
                .setTimestamp();
            
            await interaction.reply({
                embeds: [kickEmbed]
            });
            
            // Log en canal de logs
            if (process.env.LOG_CHANNEL_ID) {
                const logChannel = await client.channels.fetch(process.env.LOG_CHANNEL_ID).catch(() => null);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setColor(0xff6600)
                        .setTitle('👢 Expulsión Realizada')
                        .setThumbnail(targetUser.displayAvatarURL())
                        .addFields(
                            { name: '👤 Usuario', value: `${targetUser.tag}`, inline: true },
                            { name: '👮 Moderador', value: `${interaction.user.tag}`, inline: true },
                            { name: '📝 Motivo', value: motivo, inline: false }
                        )
                        .setTimestamp();
                    
                    await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
                }
            }
            
        } catch (error) {
            console.error('Error expulsando usuario:', error);
            await interaction.reply({
                content: `❌ Error al expulsar al usuario: ${error.message}`,
                ephemeral: true
            });
        }
    }
};
