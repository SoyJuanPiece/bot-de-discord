const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('⚠️ Advierte a un usuario por infringir las reglas')
        .addUserOption(option =>
            option
                .setName('usuario')
                .setDescription('Usuario a advertir')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('motivo')
                .setDescription('Motivo de la advertencia')
                .setRequired(true)
                .setMinLength(5)
                .setMaxLength(200)
        )
        .addIntegerOption(option =>
            option
                .setName('duracion_dias')
                .setDescription('Duración de la advertencia en días (opcional, expira después)')
                .setMinValue(1)
                .setMaxValue(365)
                .setRequired(false)
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
        const motivo = interaction.options.getString('motivo');
        const duracionDias = interaction.options.getInteger('duracion_dias');
        
        // No permitir warn al propio bot o a sí mismo
        if (targetUser.id === client.user.id) {
            return interaction.reply({
                content: '❌ No puedo advertirme a mí mismo.',
                ephemeral: true
            });
        }
        
        if (targetUser.id === interaction.user.id) {
            return interaction.reply({
                content: '❌ No puedes advertirte a ti mismo.',
                ephemeral: true
            });
        }
        
        // Verificar que el objetivo no tenga un rol de staff superior
        try {
            const targetMember = await interaction.guild.members.fetch(targetUser.id);
            const moderatorMember = interaction.member;
            
            if (targetMember.roles.highest.position >= moderatorMember.roles.highest.position) {
                return interaction.reply({
                    content: '❌ No puedes advertir a alguien con un rol igual o superior al tuyo.',
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('Error obteniendo miembro:', error);
        }
        
        // Calcular fecha de expiración si se proporcionó duración
        let expiresAt = null;
        if (duracionDias) {
            expiresAt = Math.floor(Date.now() / 1000) + (duracionDias * 24 * 60 * 60);
        }
        
        // Guardar advertencia en BD
        client.db.addWarning(targetUser.id, interaction.user.tag, motivo, expiresAt);
        
        // Obtener total de advertencias activas del usuario
        const warnings = client.db.getUserWarnings(targetUser.id);
        const totalWarnings = warnings.length;
        
        // Crear embed de advertencia
        const warnEmbed = new EmbedBuilder()
            .setColor(0xffaa00)
            .setTitle('⚠️ Advertencia Emitida')
            .addFields(
                { name: '👤 Usuario', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                { name: '👮 Moderador', value: `${interaction.user.tag}`, inline: true },
                { name: '📝 Motivo', value: motivo, inline: false },
                { name: '⏰ Expira', value: expiresAt ? `<t:${expiresAt}:R>` : 'Nunca', inline: true },
                { name: '📊 Total Advertencias', value: `${totalWarnings}`, inline: true }
            )
            .setFooter({
                text: `ID de Warn: ${Date.now().toString().slice(-6)}`
            })
            .setTimestamp();
        
        // Enviar respuesta pública
        await interaction.reply({
            embeds: [warnEmbed]
        });
        
        // Enviar DM al usuario advertido
        try {
            const dmEmbed = new EmbedBuilder()
                .setColor(0xffaa00)
                .setTitle('⚠️ Has recibido una advertencia')
                .setDescription(`
**Servidor:** ${interaction.guild.name}
**Motivo:** ${motivo}
**Moderador:** ${interaction.user.tag}
**Total de Advertencias:** ${totalWarnings}
                `)
                .setFooter({
                    text: 'Por favor respeta las reglas del servidor'
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
                    .setColor(0xffaa00)
                    .setTitle('📋 Nueva Advertencia')
                    .addFields(
                        { name: '👤 Usuario', value: `${targetUser.tag}`, inline: true },
                        { name: '👮 Moderador', value: `${interaction.user.tag}`, inline: true },
                        { name: '⚠️ Total Warns', value: `${totalWarnings}`, inline: true },
                        { name: '📝 Motivo', value: motivo, inline: false }
                    )
                    .setTimestamp();
                
                await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
            }
        }
    }
};
