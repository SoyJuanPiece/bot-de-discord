const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');

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
                .setName('agregar')
                .setDescription('➕ Agrega un usuario al ticket actual')
                .addUserOption(option =>
                    option
                        .setName('usuario')
                        .setDescription('Usuario a agregar al ticket')
                        .setRequired(true)
                )
        ),
    
    cooldown: 30000,
    
    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'crear') {
            await handleCreateTicket(interaction, client);
        } else if (subcommand === 'cerrar') {
            await handleCloseTicket(interaction, client);
        } else if (subcommand === 'agregar') {
            await handleAddUser(interaction, client);
        }
    }
};

async function handleCreateTicket(interaction, client) {
    const categoria = interaction.options.getString('categoría');
    const motivo = interaction.options.getString('motivo');
    const userId = interaction.user.id;
    const guild = interaction.guild;
    
    // Verificar si el usuario ya tiene un ticket abierto
    const existingTicket = client.db.db.prepare(`
        SELECT * FROM tickets WHERE user_id = ? AND status = 'open'
    `).get(userId);
    
    if (existingTicket) {
        return interaction.reply({
            content: `❌ Ya tienes un ticket abierto: <#${existingTicket.channel_id}>`,
            ephemeral: true
        });
    }
    
    // Obtener número de ticket
    const ticketNumber = client.db.getNextTicketNumber();
    
    // Crear nombre del canal
    const categoryNames = {
        'soporte_general': 'soporte',
        'reportes': 'reporte',
        'tienda': 'tienda',
        'apelaciones': 'apelacion'
    };
    
    const channelName = `${categoryNames[categoria]}-${ticketNumber}-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 100);
    
    // Obtener categoría de Discord (si está configurada)
    let categoryChannel = null;
    if (process.env.TICKET_CATEGORY_ID) {
        categoryChannel = await guild.channels.fetch(process.env.TICKET_CATEGORY_ID).catch(() => null);
    }
    
    // Si no hay categoría configurada, usar la primera categoría disponible o crear una
    if (!categoryChannel) {
        categoryChannel = await guild.channels.create({
            name: '🎫 Tickets',
            type: ChannelType.GuildCategory,
            permissionOverwrites: [
                {
                    id: guild.roles.everyone,
                    deny: ['ViewChannel']
                },
                {
                    id: client.user.id,
                    allow: ['ViewChannel', 'ManageChannels', 'SendMessages']
                }
            ]
        }).catch(() => null);
    }
    
    // Crear canal de ticket
    const ticketChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: categoryChannel?.id,
        permissionOverwrites: [
            {
                id: guild.roles.everyone,
                deny: ['ViewChannel']
            },
            {
                id: userId,
                allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
            },
            {
                id: client.user.id,
                allow: ['ViewChannel', 'SendMessages', 'ManageMessages']
            }
        ]
    }).catch(err => {
        console.error('Error creando canal de ticket:', err);
        return null;
    });
    
    if (!ticketChannel) {
        return interaction.reply({
            content: '❌ No se pudo crear el canal del ticket. Contacta a un administrador.',
            ephemeral: true
        });
    }
    
    // Guardar ticket en base de datos
    client.db.createTicket(
        ticketNumber,
        ticketChannel.id,
        userId,
        categoria,
        motivo,
        interaction.user.tag
    );
    
    // Categorías en español para mostrar
    const categoriaNombres = {
        'soporte_general': '📞 Soporte General',
        'reportes': '⚠️ Reportes (Hacks/Griefing)',
        'tienda': '🛒 Tienda/Compras',
        'apelaciones': '⚖️ Apelaciones de Ban/Mute'
    };
    
    // Enviar mensaje inicial en el ticket
    const ticketEmbed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('🎫 Ticket Creado')
        .setDescription(`
**Ticket #${ticketNumber}**
━━━━━━━━━━━━━━━━━━━━━━
👤 **Creado por:** ${interaction.user}
📂 **Categoría:** ${categoriaNombres[categoria]}
📝 **Motivo:** ${motivo}
🕐 **Fecha:** <t:${Math.floor(Date.now() / 1000)}:F>
        `)
        .setFooter({
            text: `ID del Ticket: ${ticketNumber} • TitanBot Support`
        })
        .setTimestamp();
    
    const closeRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`ticket_close_${ticketNumber}`)
                .setLabel('🔒 Cerrar Ticket')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`ticket_add_user_${ticketNumber}`)
                .setLabel('➕ Agregar Usuario')
                .setStyle(ButtonStyle.Primary)
        );
    
    await ticketChannel.send({
        content: `👋 ${interaction.user}, bienvenido a tu ticket de soporte. Un miembro del Staff te atenderá pronto.`,
        embeds: [ticketEmbed],
        components: [closeRow]
    });
    
    // Notificar al usuario
    await interaction.reply({
        content: `✅ Tu ticket ha sido creado: ${ticketChannel}`,
        ephemeral: true
    });
    
    // Notificar al canal de logs si existe
    if (process.env.LOG_CHANNEL_ID) {
        const logChannel = await client.channels.fetch(process.env.LOG_CHANNEL_ID).catch(() => null);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setColor(0x00ff88)
                .setTitle('🎫 Nuevo Ticket Creado')
                .addFields(
                    { name: '👤 Usuario', value: `${interaction.user.tag}`, inline: true },
                    { name: '🔢 Ticket #', value: `${ticketNumber}`, inline: true },
                    { name: '📂 Categoría', value: categoriaNombres[categoria], inline: true },
                    { name: '📝 Motivo', value: motivo.slice(0, 100), inline: false },
                    { name: '🔗 Canal', value: `${ticketChannel}`, inline: false }
                )
                .setTimestamp();
            
            await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }
    }
}

async function handleCloseTicket(interaction, client) {
    const razon = interaction.options.getString('razón') || 'Sin razón especificada';
    const channelId = interaction.channel.id;
    
    // Verificar que estamos en un canal de ticket
    const ticket = client.db.getTicketByChannel(channelId);
    
    if (!ticket) {
        return interaction.reply({
            content: '❌ Este comando solo puede usarse en un canal de ticket.',
            ephemeral: true
        });
    }
    
    // Cerrar ticket en BD
    client.db.closeTicket(channelId, razon, interaction.user.tag);
    
    // Crear embed de cierre
    const closeEmbed = new EmbedBuilder()
        .setColor(0xff4444)
        .setTitle('🔒 Ticket Cerrado')
        .setDescription(`
**Ticket #${ticket.ticket_number}** ha sido cerrado.

📝 **Razón:** ${razon}
👤 **Cerrado por:** ${interaction.user.tag}
🕐 **Fecha:** <t:${Math.floor(Date.now() / 1000)}:F>
        `)
        .setFooter({
            text: 'Gracias por usar nuestro sistema de soporte'
        })
        .setTimestamp();
    
    await interaction.channel.send({ embeds: [closeEmbed] });
    
    // Responder al usuario
    await interaction.reply({
        content: '✅ El ticket será cerrado en 5 segundos...',
        ephemeral: true
    });
    
    // Esperar y archivar/eliminar el canal
    setTimeout(async () => {
        try {
            // Aquí podrías implementar la lógica para guardar transcripción
            // Por ahora, simplemente eliminamos el canal
            
            // Opcional: Crear un canal de archivo en lugar de eliminar
            await interaction.channel.delete();
        } catch (error) {
            console.error('Error cerrando ticket:', error);
        }
    }, 5000);
}

async function handleAddUser(interaction, client) {
    const userToAdd = interaction.options.getUser('usuario');
    const channelId = interaction.channel.id;
    
    // Verificar que estamos en un canal de ticket
    const ticket = client.db.getTicketByChannel(channelId);
    
    if (!ticket) {
        return interaction.reply({
            content: '❌ Este comando solo puede usarse en un canal de ticket.',
            ephemeral: true
        });
    }
    
    // Agregar permisos al usuario
    try {
        await interaction.channel.permissionOverwrites.edit(userToAdd, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
        });
        
        // Registrar en BD
        client.db.addTicketParticipant(ticket.id, userToAdd.id, interaction.user.tag);
        
        await interaction.reply({
            content: `✅ ${userToAdd} ha sido agregado al ticket.`,
            ephemeral: true
        });
        
        // Notificar en el canal
        await interaction.channel.send({
            content: `➕ ${interaction.user} ha agregado a ${userToAdd} al ticket.`
        });
        
    } catch (error) {
        console.error('Error agregando usuario al ticket:', error);
        await interaction.reply({
            content: '❌ No se pudo agregar al usuario. Verifica los permisos.',
            ephemeral: true
        });
    }
}
