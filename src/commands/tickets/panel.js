const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('panel')
        .setDescription('🎫 Envía el panel de tickets a un canal')
        .addChannelOption(option =>
            option
                .setName('canal')
                .setDescription('Canal donde se enviará el panel')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
        ),
    
    cooldown: 30000,
    
    async execute(interaction, client) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: '❌ Necesitas permisos de **Administrador** para usar este comando.',
                ephemeral: true
            });
        }
        
        const canal = interaction.options.getChannel('canal');
        
        const panelEmbed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle('🎫 Centro de Soporte - TitanBot')
            .setDescription(`
Bienvenido al sistema de soporte del servidor.

Selecciona una categoría según tu necesidad:

📞 **Soporte General** — Dudas, ayuda con el servidor o el bot
⚠️ **Reportes** — Reportar hacks, griefing o usuarios problemáticos
🛒 **Tienda** — Problemas con compras o entregas
⚖️ **Apelaciones** — Apelar un baneo o mute

Haz clic en el botón de abajo para abrir un ticket.
Un miembro del staff te atenderá lo antes posible.
            `)
            .setThumbnail(interaction.guild.iconURL())
            .setFooter({ text: 'TitanBot • Sistema de Tickets' })
            .setTimestamp();
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('panel_ticket_soporte_general')
                .setLabel('📞 Soporte General')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('panel_ticket_reportes')
                .setLabel('⚠️ Reportes')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('panel_ticket_tienda')
                .setLabel('🛒 Tienda')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('panel_ticket_apelaciones')
                .setLabel('⚖️ Apelaciones')
                .setStyle(ButtonStyle.Secondary)
        );
        
        await canal.send({ embeds: [panelEmbed], components: [row] });
        
        await interaction.reply({
            content: `✅ Panel de tickets enviado a ${canal}`,
            ephemeral: true
        });
    }
};
