const { ButtonStyle } = require('discord.js');

/**
 * Maneja las interacciones de botones
 */
async function handleInteraction(interaction, client, action, params) {
    switch (action) {
        case 'shop':
            await handleShopButton(interaction, client, params[0]);
            break;
        case 'ticket':
            await handleTicketButton(interaction, client, params);
            break;
        default:
            console.log(`Acción de botón desconocida: ${action}`);
    }
}

/**
 * Maneja botones de la tienda
 */
async function handleShopButton(interaction, client, buttonType) {
    if (buttonType === 'refresh') {
        // Actualizar la tienda
        const items = client.db.getAllShopItems();
        
        if (items.length === 0) {
            return interaction.reply({
                content: '❌ La tienda está vacía actualmente.',
                ephemeral: true
            });
        }
        
        const userData = client.db.getUser(interaction.user.id);
        const userCoins = userData ? userData.coins : 0;
        
        // Reconstruir embed (simplificado)
        const { EmbedBuilder } = require('discord.js');
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

/**
 * Maneja botones de tickets
 */
async function handleTicketButton(interaction, client, params) {
    const ticketAction = params[0];
    const ticketNumber = params[1];
    
    if (ticketAction === 'close') {
        // Verificar permisos (solo staff o creador del ticket)
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
        
        // Mostrar modal para razón de cierre
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
        
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
        // Mostrar select menu para agregar usuario
        await interaction.reply({
            content: '➕ Usa `/ticket agregar [@usuario]` para agregar alguien al ticket.',
            ephemeral: true
        });
    }
}

module.exports = { handleInteraction };
