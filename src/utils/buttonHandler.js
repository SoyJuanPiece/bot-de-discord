const { ButtonStyle, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType } = require('discord.js');

async function handleInteraction(interaction, client, action, params) {
    switch (action) {
        case 'shop':
            await handleShopButton(interaction, client, params[0]);
            break;
        case 'ticket':
            await handleTicketButton(interaction, client, params);
            break;
        case 'panel':
            await handlePanelButton(interaction, client, params);
            break;
        default:
            console.log(`Acción de botón desconocida: ${action}`);
    }
}

async function handleShopButton(interaction, client, buttonType) {
    if (buttonType === 'refresh') {
        const userData = client.db.getUser(interaction.user.id);
        const userCoins = userData ? userData.coins : 0;
        
        const shopEmbed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle('🛒 Tienda de TitanBot')
            .setDescription(`💰 **Tu Saldo:** ${userCoins.toLocaleString()} 🪙`)
            .setTimestamp();
        
        await interaction.update({
            embeds: [shopEmbed],
            components: interaction.message.components
        });
    } else if (buttonType === 'help') {
        await interaction.reply({
            content: `📚 **Ayuda de la Tienda:**\n\n1. Usa \`/tienda\` para ver el catálogo completo\n2. Usa \`/comprar [item_id]\` para comprar un item\n3. Los items se entregan automáticamente o mediante ticket\n4. Para reembolsos, abre un ticket en la categoría **Tienda**`,
            ephemeral: true
        });
    }
}

async function handleTicketButton(interaction, client, params) {
    const ticketAction = params[0];
    const ticketNumber = params[1];
    
    if (ticketAction === 'close') {
        const ticket = client.db.getTicketByChannel(interaction.channel.id);
        
        if (!ticket) {
            return interaction.reply({
                content: '❌ Este ticket no existe en la base de datos.',
                ephemeral: true
            });
        }
        
        const isStaff = interaction.member.permissions.has('ModerateMembers');
        const isCreator = ticket.user_id === interaction.user.id;
        
        if (!isStaff && !isCreator) {
            return interaction.reply({
                content: '❌ No tienes permisos para cerrar este ticket.',
                ephemeral: true
            });
        }
        
        const modal = new ModalBuilder()
            .setCustomId(`modal_close_${ticketNumber}`)
            .setTitle('🔒 Cerrar Ticket');
        
        const reasonInput = new TextInputBuilder()
            .setCustomId('close_reason')
            .setLabel('Razón para cerrar el ticket')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Describe brevemente por qué cierras este ticket')
            .setMinLength(5)
            .setMaxLength(200)
            .setRequired(false);
        
        const row = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(row);
        
        await interaction.showModal(modal);
        
    } else if (ticketAction === 'add') {
        await interaction.reply({
            content: '➕ Usa `/ticket agregar [@usuario]` para agregar alguien al ticket.',
            ephemeral: true
        });
    }
}

async function handlePanelButton(interaction, client, params) {
    const categoria = params.slice(1).join('_');
    
    const modal = new ModalBuilder()
        .setCustomId(`modal_ticket_${categoria}`)
        .setTitle(`🎫 Ticket - ${categoria.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`);
    
    const reasonInput = new TextInputBuilder()
        .setCustomId('ticket_reason')
        .setLabel('Describe tu problema o consulta')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Escribe el motivo detallado del ticket...')
        .setMinLength(10)
        .setMaxLength(500)
        .setRequired(true);
    
    const row = new ActionRowBuilder().addComponents(reasonInput);
    modal.addComponents(row);
    
    await interaction.showModal(modal);
}

module.exports = { handleInteraction };
