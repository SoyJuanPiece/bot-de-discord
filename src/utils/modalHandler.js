const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { createTicket, closeTicket } = require('../services/ticketService');

async function handleInteraction(interaction, client, action, params) {
    if (action === 'modal' && params[0] === 'close') {
        await handleCloseTicket(interaction, client, params[1]);
    } else if (action === 'modal' && params[0] === 'ticket') {
        await handleCreateTicketFromPanel(interaction, client, params[1]);
    } else {
        await interaction.deferUpdate();
    }
}

async function handleCloseTicket(interaction, client, ticketNumber) {
    const reason = interaction.fields.getTextInputValue('close_reason') || 'Sin razón especificada';
    const channel = interaction.channel || (interaction.message?.channel);
    if (!channel) {
        return interaction.reply({ content: '❌ No se pudo determinar el canal del ticket.', ephemeral: true });
    }
    const ticket = client.db.getTicketByChannel(channel.id);

    await closeTicket(client, interaction, ticketNumber, reason);
}

async function handleCreateTicketFromPanel(interaction, client, categoria) {
    const motivo = interaction.fields.getTextInputValue('ticket_reason');
    const userId = interaction.user.id;
    const guild = interaction.guild;

    const existingTicket = client.db._get(
        "SELECT * FROM tickets WHERE user_id = ? AND status = 'open'",
        [userId]
    );
    if (existingTicket) {
        const channel = await guild.channels.fetch(existingTicket.channel_id).catch(() => null);
        if (channel) {
            return interaction.reply({ content: `❌ Ya tienes un ticket abierto: <#${existingTicket.channel_id}>`, ephemeral: true });
        }
        client.db._run("UPDATE tickets SET status = 'closed', closed_reason = 'Canal eliminado' WHERE id = ?", [existingTicket.id]);
    }

    await interaction.deferReply({ ephemeral: true });
    const result = await createTicket(client, interaction, categoria, motivo);
    if (!result) {
        return interaction.editReply({ content: '❌ No se pudo crear el canal del ticket. Contacta a un administrador.' });
    }
    await interaction.editReply({ content: `✅ Tu ticket ha sido creado: ${result.ticketChannel}` });
}

module.exports = { handleInteraction };
