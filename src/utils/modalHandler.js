/**
 * Maneja las interacciones de modales (placeholders)
 */
async function handleInteraction(interaction, client, action, params) {
    console.log(`Modal interaction: ${action}`, params);
    
    if (action === 'modal' && params[0] === 'close') {
        const ticketNumber = params[1];
        const reason = interaction.fields.getTextInputValue('close_reason');
        
        // Cerrar ticket con la razón proporcionada
        const ticket = client.db.getTicketByChannel(interaction.channel.id);
        
        if (!ticket) {
            return interaction.reply({
                content: '❌ Este ticket no existe en la base de datos.',
                ephemeral: true
            });
        }
        
        // Cerrar ticket en BD
        client.db.closeTicket(interaction.channel.id, reason || 'Sin razón especificada', interaction.user.tag);
        
        // Crear embed de cierre
        const { EmbedBuilder } = require('discord.js');
        const closeEmbed = new EmbedBuilder()
            .setColor(0xff4444)
            .setTitle('🔒 Ticket Cerrado')
            .setDescription(`
**Ticket #${ticket.ticket_number}** ha sido cerrado.

📝 **Razón:** ${reason || 'Sin razón especificada'}
👤 **Cerrado por:** ${interaction.user.tag}
🕐 **Fecha:** <t:${Math.floor(Date.now() / 1000)}:F>
            `)
            .setFooter({
                text: 'Gracias por usar nuestro sistema de soporte'
            })
            .setTimestamp();
        
        await interaction.channel.send({ embeds: [closeEmbed] });
        
        // Responder al modal
        await interaction.reply({
            content: '✅ El ticket será cerrado en 5 segundos...',
            ephemeral: true
        });
        
        // Esperar y eliminar el canal
        setTimeout(async () => {
            try {
                await interaction.channel.delete();
            } catch (error) {
                console.error('Error cerrando ticket:', error);
            }
        }, 5000);
    } else {
        await interaction.deferUpdate();
    }
}

module.exports = { handleInteraction };
