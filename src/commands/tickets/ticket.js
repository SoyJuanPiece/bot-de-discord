const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { createTicket, closeTicket } = require('../../services/ticketService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('🎫 Sistema de soporte y tickets')
        .addSubcommand(subcommand =>
            subcommand
                .setName('crear')
                .setDescription('🎫 Crea un nuevo ticket de soporte')
                .addStringOption(option =>
                    option
                        .setName('categoría')
                        .setDescription('Categoría del ticket')
                        .setRequired(true)
                        .addChoices(
                            { name: '📞 Soporte General', value: 'soporte_general' },
                            { name: '⚠️ Reportes (Hacks/Griefing)', value: 'reportes' },
                            { name: '🛒 Tienda/Compras', value: 'tienda' },
                            { name: '⚖️ Apelaciones de Ban/Mute', value: 'apelaciones' }
                        )
                )
                .addStringOption(option =>
                    option
                        .setName('motivo')
                        .setDescription('Motivo detallado del ticket')
                        .setRequired(true)
                        .setMinLength(10)
                        .setMaxLength(500)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('cerrar')
                .setDescription('🔒 Cierra el ticket actual')
                .addStringOption(option =>
                    option
                        .setName('razón')
                        .setDescription('Razón para cerrar el ticket')
                        .setRequired(false)
                        .setMinLength(5)
                        .setMaxLength(200)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('📊 Muestra todos los tickets abiertos')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('asignar')
                .setDescription('👤 Asigna un ticket a un staff')
                .addUserOption(option => option.setName('usuario').setDescription('El staff a asignar').setRequired(true))
        ),

    cooldown: 30000,

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'crear') {
            await handleCreateTicket(interaction, client);
        } else if (subcommand === 'cerrar') {
            await handleCloseTicket(interaction, client);
        } else if (subcommand === 'agregar') {
            await handleAddUser(interaction, client);
        } else if (subcommand === 'status') {
            await handleStatus(interaction, client);
        } else if (subcommand === 'asignar') {
            await handleAssign(interaction, client);
        }
    }
};

async function handleCreateTicket(interaction, client) {
    const categoria = interaction.options.getString('categoría');
    const motivo = interaction.options.getString('motivo');

    const existingTicket = client.db._get(
        "SELECT * FROM tickets WHERE user_id = ? AND status = 'open'",
        [interaction.user.id]
    );
    if (existingTicket) {
        const channel = await interaction.guild.channels.fetch(existingTicket.channel_id).catch(() => null);
        if (channel) {
            return interaction.editReply({ content: `❌ Ya tienes un ticket abierto: <#${existingTicket.channel_id}>` });
        }
        client.db._run("UPDATE tickets SET status = 'closed', closed_reason = 'Canal eliminado' WHERE id = ?", [existingTicket.id]);
    }

    const result = await createTicket(client, interaction, categoria, motivo);
    if (!result) {
        return interaction.editReply({ content: '❌ No se pudo crear el canal del ticket. Contacta a un administrador.', ephemeral: true });
    }

    await interaction.editReply({ content: `✅ Tu ticket ha sido creado: ${result.ticketChannel}` });
}

async function handleCloseTicket(interaction, client) {
    const razon = interaction.options.getString('razón') || 'Sin razón especificada';
    const ticket = client.db.getTicketByChannel(interaction.channel.id);
    if (!ticket) {
        return interaction.editReply({ content: '❌ Este comando solo puede usarse en un canal de ticket.', ephemeral: true });
    }

    const result = await closeTicket(client, interaction, ticket.ticket_number, razon);
    if (!result) {
        return interaction.editReply({ content: '❌ No se pudo cerrar el ticket.', ephemeral: true });
    }
}

async function handleAddUser(interaction, client) {
    const userToAdd = interaction.options.getUser('usuario');
    const channelId = interaction.channel.id;
    const ticket = client.db.getTicketByChannel(channelId);
    if (!ticket) {
        return interaction.editReply({ content: '❌ Este comando solo puede usarse en un canal de ticket.', ephemeral: true });
    }
    try {
        await interaction.channel.permissionOverwrites.edit(userToAdd, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
        client.db.addTicketParticipant(ticket.id, userToAdd.id, interaction.user.tag);
        await interaction.editReply({ content: `✅ ${userToAdd} ha sido agregado al ticket.`, ephemeral: true });
        await interaction.channel.send({ content: `➕ ${interaction.user} ha agregado a ${userToAdd} al ticket.` });
    } catch (error) {
        console.error('Error agregando usuario al ticket:', error);
        await interaction.editReply({ content: '❌ No se pudo agregar al usuario. Verifica los permisos.', ephemeral: true });
    }
}

async function handleStatus(interaction, client) {
    const openTickets = client.db.getOpenTickets();
    if (!openTickets || openTickets.length === 0) {
        return interaction.editReply({ content: '📭 No hay tickets abiertos en este momento.', ephemeral: true });
    }
    const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('📊 Tickets Abiertos')
        .setDescription(openTickets.map(t => `• **#${t.ticket_number}** - <#${t.channel_id}> | Creador: <@${t.user_id}> | Staff: ${t.assigned_to ? `<@${t.assigned_to}>` : 'Sin asignar'}`).join('\n'))
        .setTimestamp();
    await interaction.editReply({ embeds: [embed], ephemeral: true });
}

async function handleAssign(interaction, client) {
    const channelId = interaction.channel.id;
    const ticket = client.db.getTicketByChannel(channelId);
    if (!ticket) {
        return interaction.editReply({ content: '❌ Este comando solo puede usarse en un canal de ticket.', ephemeral: true });
    }
    const assignedUser = interaction.options.getUser('usuario');
    client.db.assignTicket(ticket.ticket_number, assignedUser.id);
    await interaction.editReply({ content: `✅ El ticket #${ticket.ticket_number} ha sido asignado a ${assignedUser}.`, ephemeral: true });
    await interaction.channel.send({ content: `👤 **${interaction.user.tag}** ha asignado este ticket a ${assignedUser}.` });
}
