const { EmbedBuilder } = require('discord.js');
const { createTicket } = require('../services/ticketService');

async function handleInteraction(interaction, client, action, params) {
    if (action === 'panel') {
        const categoria = params[1] || params.join('_');
        if (!categoria) {
            return interaction.deferUpdate();
        }
        const validCategories = ['soporte_general', 'reportes', 'tienda', 'apelaciones'];
        if (!validCategories.includes(categoria)) {
            return interaction.deferUpdate();
        }
        await interaction.deferUpdate();
        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle('🎫 Nuevo Ticket')
            .setDescription(`**Categoría:** ${categoria}\n\nHaz clic en el botón de abajo para crear un ticket.`);
        await interaction.followUp({ embeds: [embed], ephemeral: true });
    } else {
        await interaction.deferUpdate();
    }
}

module.exports = { handleInteraction };
