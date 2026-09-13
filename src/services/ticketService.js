const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { sendLog } = require('../utils/logService');

const CATEGORY_NAMES = {
    'soporte_general': '📞 Soporte General',
    'reportes': '⚠️ Reportes (Hacks/Griefing)',
    'tienda': '🛒 Tienda/Compras',
    'apelaciones': '⚖️ Apelaciones de Ban/Mute'
};

async function createTicket(client, interaction, categoria, motivo) {
    const userId = interaction.user.id;
    const guild = interaction.guild;
    const ticketNumber = client.db.getNextTicketNumber();

    const categoryChannelNames = {
        'soporte_general': 'soporte',
        'reportes': 'reporte',
        'tienda': 'tienda',
        'apelaciones': 'apelacion'
    };

    const channelName = `${categoryChannelNames[categoria] || 'ticket'}-${ticketNumber}-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 100);

    let categoryChannel = null;
    const configuredCategory = client.db.getTicketCategory(guild.id);
    if (configuredCategory) {
        categoryChannel = await guild.channels.fetch(configuredCategory).catch(() => null);
    }
    if (!categoryChannel) {
        categoryChannel = guild.channels.cache.find(ch => ch.type === 4 && ch.name === '🎫 Tickets' && !ch.deleted);
    }
    if (!categoryChannel) {
        categoryChannel = await guild.channels.create({ name: '🎫 Tickets', type: ChannelType.GuildCategory, permissionOverwrites: [{ id: guild.roles.everyone, deny: ['ViewChannel'] }, { id: client.user.id, allow: ['ViewChannel', 'ManageChannels', 'SendMessages'] }] }).catch(() => null);
    }

    const ticketStaffRole = client.db.getGuildConfig(guild.id)?.ticket_staff_role;
    const permissionOverwrites = [
        { id: guild.roles.everyone, deny: ['ViewChannel'] },
        { id: userId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
        { id: client.user.id, allow: ['ViewChannel', 'SendMessages', 'ManageMessages'] }
    ];
    if (ticketStaffRole) {
        permissionOverwrites.push({ id: ticketStaffRole, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages'] });
    }

    const ticketChannel = await guild.channels.create({ name: channelName, type: ChannelType.GuildText, parent: categoryChannel?.id, permissionOverwrites }).catch(err => { console.error('Error creando canal de ticket:', err); return null; });
    if (!ticketChannel) return null;

    client.db.createTicket(ticketNumber, ticketChannel.id, userId, categoria, motivo, interaction.user.tag);

    const ticketEmbed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('🎫 Ticket Creado')
        .setDescription(`\n**Ticket #${ticketNumber}**\n━━━━━━━━━━━━━━━━━━━━━━\n👤 **Creado por:** ${interaction.user}\n📂 **Categoría:** ${CATEGORY_NAMES[categoria] || categoria}\n📝 **Motivo:** ${motivo}\n🕐 **Fecha:** <t:${Math.floor(Date.now() / 1000)}:F>\n        `)
        .setFooter({ text: `ID del Ticket: ${ticketNumber} • TitanBot Support` })
        .setTimestamp();

    const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ticket_close_${ticketNumber}`).setLabel('🔒 Cerrar Ticket').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`ticket_add_${ticketNumber}`).setLabel('➕ Agregar Usuario').setStyle(ButtonStyle.Primary)
    );

    await ticketChannel.send({ content: `👋 ${interaction.user}, bienvenido a tu ticket de soporte. Un miembro del Staff te atenderá pronto.`, embeds: [ticketEmbed], components: [closeRow] });

    return { ticketNumber, ticketChannel, ticketEmbed };
}

async function closeTicket(client, interaction, ticketNumber) {
    const channel = interaction.channel;
    const ticket = client.db.getTicketByChannel(channel.id);
    if (!ticket) return null;

    const razon = interaction.fields?.getTextInputValue?.('close_reason') || 'Sin razón especificada';

    const messages = [];
    let lastId = null;
    let fetchDone = false;
    while (!fetchDone) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;
        const batch = await channel.messages.fetch(options).catch(() => new Map());
        if (batch.size === 0) { fetchDone = true; }
        else { batch.forEach(msg => messages.push(msg)); lastId = batch.last()?.id; if (batch.size < 100) fetchDone = true; }
    }
    messages.reverse();

    let transcript = `Transcripción del Ticket #${ticket.ticket_number}\n`;
    transcript += `Categoría: ${ticket.category || 'Sin categoría'}\n`;
    transcript += `Creado por: <@${ticket.user_id}>\n`;
    transcript += `Fecha de cierre: ${new Date().toLocaleString('es-ES')}\n`;
    transcript += `Razón: ${razon}\n`;
    transcript += '═'.repeat(50) + '\n\n';

    for (const msg of messages) {
        const timestamp = `<t:${Math.floor(msg.createdTimestamp / 1000)}:t>`;
        transcript += `[${timestamp}] ${msg.author.tag}: ${msg.content || '(sin texto)'}\n`;
        if (msg.attachments.size > 0) { msg.attachments.forEach(a => transcript += `  📎 Adjunto: ${a.name}\n`); }
    }

    client.db.closeTicket(channel.id, razon, interaction.user.tag);

    const closeEmbed = new EmbedBuilder()
        .setColor(0xff4444)
        .setTitle('🔒 Ticket Cerrado')
        .setDescription(`\n**Ticket #${ticket.ticket_number}** ha sido cerrado.\n\n📝 **Razón:** ${razon}\n👤 **Cerrado por:** ${interaction.user.tag}\n🕐 **Fecha:** <t:${Math.floor(Date.now() / 1000)}:F>\n        `)
        .setFooter({ text: 'Gracias por usar nuestro sistema de soporte' })
        .setTimestamp();

    await channel.send({ embeds: [closeEmbed] });

    sendLog(client, interaction.guild.id, `🔒 Ticket #${ticket.ticket_number} cerrado`, [
        { name: '📂 Categoría', value: ticket.category || 'Sin categoría', inline: true },
        { name: '👤 Creado por', value: `<@${ticket.user_id}>`, inline: true },
        { name: '🔒 Cerrado por', value: interaction.user.tag, inline: true },
        { name: '📝 Razón', value: razon, inline: false }
    ], transcript);

    await interaction.reply({ content: '✅ El ticket será cerrado en 5 segundos...', ephemeral: true });

    const channelId = channel.id;
    setTimeout(async () => {
        try { const ch = await client.channels.fetch(channelId); if (ch) await ch.delete(); } catch (error) { console.error('Error cerrando ticket:', error); }
    }, 5000);

    return ticket;
}

module.exports = { createTicket, closeTicket };
