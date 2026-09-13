const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('⚙️ Configura las opciones del bot en este servidor')
        .addSubcommand(subcommand =>
            subcommand
                .setName('ver')
                .setDescription('📋 Muestra la configuración actual del bot')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('logs')
                .setDescription('📝 Establece el canal de logs de moderación')
                .addChannelOption(option =>
                    option
                        .setName('canal')
                        .setDescription('Canal o foro donde se registrarán las acciones de moderación')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildForum)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('tickets')
                .setDescription('🎫 Establece la categoría de tickets')
                .addChannelOption(option =>
                    option
                        .setName('categoria')
                        .setDescription('Categoría donde se crearán los tickets')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildCategory)
                )
                .addRoleOption(option =>
                    option
                        .setName('rol_staff')
                        .setDescription('Rol que puede ver y atender tickets')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('recompensas')
                .setDescription('🎁 Configura las recompensas de XP y monedas')
                .addIntegerOption(option =>
                    option
                        .setName('xp_por_mensaje')
                        .setDescription('XP ganado por mensaje (1-100)')
                        .setMinValue(1)
                        .setMaxValue(100)
                        .setRequired(false)
                )
                .addIntegerOption(option =>
                    option
                        .setName('recompensa_diaria')
                        .setDescription('Monedas de recompensa diaria (1-1000)')
                        .setMinValue(1)
                        .setMaxValue(1000)
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('automod')
                .setDescription('🛡️ Activa o desactiva la auto-moderación')
                .addBooleanOption(option =>
                    option
                        .setName('activar')
                        .setDescription('Activar o desactivar auto-moderación')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset')
                .setDescription('🔄 Resetea toda la configuración del bot')
        ),
    
    cooldown: 5000,
    
    async execute(interaction, client) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: '❌ Necesitas permisos de **Administrador** para usar este comando.',
                ephemeral: true
            });
        }
        
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        
        switch (subcommand) {
            case 'ver':
                await handleVer(interaction, client, guildId);
                break;
            case 'logs':
                await handleLogs(interaction, client, guildId);
                break;
            case 'tickets':
                await handleTickets(interaction, client, guildId);
                break;
            case 'recompensas':
                await handleRecompensas(interaction, client, guildId);
                break;
            case 'automod':
                await handleAutomod(interaction, client, guildId);
                break;
            case 'reset':
                await handleReset(interaction, client, guildId);
                break;
        }
    }
};

async function handleVer(interaction, client, guildId) {
    const config = client.db.getGuildConfig(guildId);
    
    const logChannel = config?.log_channel
        ? `<#${config.log_channel}>`
        : '❌ No configurado';
    
    const ticketCategory = config?.ticket_category
        ? `<#${config.ticket_category}>`
        : '❌ No configurado (se crea automáticamente)';
    
    const ticketStaffRole = config?.ticket_staff_role
        ? `<@&${config.ticket_staff_role}>`
        : '❌ No configurado (solo el usuario y admins)';
    
    const xpPerMsg = config?.xp_per_message || 15;
    const dailyReward = config?.daily_reward || 100;
    const autoMod = config?.auto_mod_enabled ? '✅ Activado' : '❌ Desactivado';
    
    const configEmbed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('⚙️ Configuración del Bot')
        .setDescription(`Configuración actual de **${interaction.guild.name}**`)
        .addFields(
            { name: '📝 Canal de Logs', value: logChannel, inline: true },
            { name: '🎫 Categoría de Tickets', value: ticketCategory, inline: true },
            { name: '👥 Rol Staff Tickets', value: ticketStaffRole, inline: true },
            { name: '💬 XP por Mensaje', value: `${xpPerMsg}`, inline: true },
            { name: '🎁 Recompensa Diaria', value: `${dailyReward} 🪙`, inline: true },
            { name: '🛡️ Auto-Moderación', value: autoMod, inline: true }
        )
        .setFooter({ text: 'Usa /config [opcion] para cambiar la configuración' })
        .setTimestamp();
    
    await interaction.reply({ embeds: [configEmbed], ephemeral: true });
}

async function handleLogs(interaction, client, guildId) {
    const canal = interaction.options.getChannel('canal');
    
    client.db.setGuildConfig(guildId, 'log_channel', canal.id);
    
    const embed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle('📝 Canal de Logs Configurado')
        .setDescription(`El canal de logs ha sido establecido en ${canal}`)
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
}

async function handleTickets(interaction, client, guildId) {
    const categoria = interaction.options.getChannel('categoria');
    const rolStaff = interaction.options.getRole('rol_staff');
    
    client.db.setGuildConfig(guildId, 'ticket_category', categoria.id);
    
    const changes = [`Categoría: **${categoria.name}**`];
    
    if (rolStaff) {
        client.db.setGuildConfig(guildId, 'ticket_staff_role', rolStaff.id);
        changes.push(`Rol staff: ${rolStaff}`);
    }
    
    const embed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle('🎫 Tickets Configurados')
        .setDescription(changes.join('\n'))
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
}

async function handleRecompensas(interaction, client, guildId) {
    const xpPorMensaje = interaction.options.getInteger('xp_por_mensaje');
    const recompensaDiaria = interaction.options.getInteger('recompensa_diaria');
    
    const changes = [];
    
    if (xpPorMensaje !== null) {
        client.db.setGuildConfig(guildId, 'xp_per_message', xpPorMensaje);
        changes.push(`XP por mensaje: **${xpPorMensaje}**`);
    }
    
    if (recompensaDiaria !== null) {
        client.db.setGuildConfig(guildId, 'daily_reward', recompensaDiaria);
        changes.push(`Recompensa diaria: **${recompensaDiaria} 🪙**`);
    }
    
    if (changes.length === 0) {
        return interaction.reply({
            content: '❌ Debes especificar al menos una opción para cambiar.',
            ephemeral: true
        });
    }
    
    const embed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle('🎁 Recompensas Actualizadas')
        .setDescription(changes.join('\n'))
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
}

async function handleAutomod(interaction, client, guildId) {
    const activar = interaction.options.getBoolean('activar');
    
    client.db.setGuildConfig(guildId, 'auto_mod_enabled', activar ? 1 : 0);
    
    const embed = new EmbedBuilder()
        .setColor(activar ? 0x00ff88 : 0xff4444)
        .setTitle('🛡️ Auto-Moderación')
        .setDescription(`Auto-moderación **${activar ? 'activada' : 'desactivada'}**.`)
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
}

async function handleReset(interaction, client, guildId) {
    client.db.db.run('DELETE FROM guild_config WHERE guild_id = ?', [guildId]);
    client.db.save();
    
    const embed = new EmbedBuilder()
        .setColor(0xff4444)
        .setTitle('🔄 Configuración Reseteada')
        .setDescription('Toda la configuración del bot ha sido reseteada a los valores por defecto.')
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
}
