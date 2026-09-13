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
    const userId = interaction.user.id;
    const guild = interaction.guild;
    
    // Verificar si el usuario ya tiene un ticket abierto
    const existingTicket = client.db._get(
        'SELECT * FROM tickets WHERE user_id = ? AND status = \'open\'',
        [userId]
    );
    
    if (existingTicket) {
        const channel = await guild.channels.fetch(existingTicket.channel_id).catch(() => null);
        if (channel) {
            return interaction.editReply({
                content: `❌ Ya tienes un ticket abierto: <#${existingTicket.channel_id}>`
            });
        }
        client.db._run('UPDATE tickets SET status = \'closed\', closed_reason = \'Canal eliminado\' WHERE id = ?', [existingTicket.id]);
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
    const configuredCategory = client.db.getTicketCategory(guild.id);
    if (configuredCategory) {
        categoryChannel = await guild.channels.fetch(configuredCategory).catch(() => null);
    }
    
    // Si no hay categoría configurada, buscar la categoría "🎫 Tickets" existente
    if (!categoryChannel) {
        categoryChannel = guild.channels.cache.find(
            ch => ch.type === 4 && ch.name === '🎫 Tickets' && !ch.deleted
        );
    }
    
    // Si no existe, crearla
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
    const ticketStaffRole = client.db.getGuildConfig(guild.id)?.ticket_staff_role;
    const permissionOverwrites = [
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
    ];
    if (ticketStaffRole) {
        permissionOverwrites.push({
            id: ticketStaffRole,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages']
        });
    }
    
    const ticketChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: categoryChannel?.id,
        permissionOverwrites
    }).catch(err => {
        console.error('Error creando canal de ticket:', err);
        return null;
    });
    
    if (!ticketChannel) {
        return interaction.editReply({
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
     await interaction.editReply({
         content: `✅ Tu ticket ha sido creado: ${ticketChannel}`,
         ephemeral: true
     });
}

async function handleCloseTicket(interaction, client) {
    const razon = interaction.options.getString('razón') || 'Sin razón especificada';
    const channelId = interaction.channel.id;
    
    // Verificar que estamos en un canal de ticket
    const ticket = client.db.getTicketByChannel(channelId);
    
    if (!ticket) {
        return interaction.editReply({
            content: '❌ Este comando solo puede usarse en un canal de ticket.',
            ephemeral: true
        });
    }
    
    // Recoger mensajes antes de cerrar
    const messages = [];
    let lastId = null;
    let fetchDone = false;
    while (!fetchDone) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;
        const batch = await interaction.channel.messages.fetch(options).catch(() => new Map());
        if (batch.size === 0) {
            fetchDone = true;
        } else {
            batch.forEach(msg => messages.push(msg));
            lastId = batch.last()?.id;
            if (batch.size < 100) fetchDone = true;
        }
    }
    messages.reverse();
    
    // Formatear transcripción
    let transcript = `Transcripción del Ticket #${ticket.ticket_number}\n`;
    transcript += `Categoría: ${ticket.category || 'Sin categoría'}\n`;
    transcript += `Creado por: <@${ticket.user_id}>\n`;
    transcript += `Fecha de cierre: ${new Date().toLocaleString('es-ES')}\n`;
    transcript += `Razón: ${razon}\n`;
    transcript += '═'.repeat(50) + '\n\n';
    
    for (const msg of messages) {
        const timestamp = `<t:${Math.floor(msg.createdTimestamp / 1000)}:t>`;
        transcript += `[${timestamp}] ${msg.author.tag}: ${msg.content || '(sin texto)'}\n`;
        if (msg.attachments.size > 0) {
            msg.attachments.forEach(a => transcript += `  📎 Adjunto: ${a.name}\n`);
        }
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
    
    // Enviar log al canal de logs
    const guildConfig = client.db.getGuildConfig(interaction.guild.id);
    if (guildConfig?.log_channel) {
        const logChannel = await interaction.guild.channels.fetch(guildConfig.log_channel).catch(() => null);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setColor(0xff4444)
                .setTitle(`🔒 Ticket #${ticket.ticket_number} cerrado`)
                .addFields(
                    { name: '📂 Categoría', value: ticket.category || 'Sin categoría', inline: true },
                    { name: '👤 Creado por', value: `<@${ticket.user_id}>`, inline: true },
                    { name: '🔒 Cerrado por', value: interaction.user.tag, inline: true },
                    { name: '📝 Razón', value: razon, inline: false }
                )
                .setTimestamp();
            
            const transcriptContent = transcript.length > 2000
                ? transcript.slice(0, 1997) + '...'
                : transcript;
            
            if (logChannel.type === 15) {
                await logChannel.threads.create({
                    name: `Ticket #${ticket.ticket_number}`,
                    message: {
                        embeds: [logEmbed],
                        content: `\`\`\`\n${transcriptContent}\n\`\`\``
                    }
                }).catch(() => null);
            } else {
                await logChannel.send({
                    embeds: [logEmbed],
                    content: `\`\`\`\n${transcriptContent}\n\`\`\``
                }).catch(() => null);
            }
        }
    }
    
    // Responder al usuario
    await interaction.editReply({
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
        return interaction.editReply({
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
        
        await interaction.editReply({
            content: `✅ ${userToAdd} ha sido agregado al ticket.`,
            ephemeral: true
        });
        
        // Notificar en el canal
        await interaction.channel.send({
            content: `➕ ${interaction.user} ha agregado a ${userToAdd} al ticket.`
        });
        
    } catch (error) {
        console.error('Error agregando usuario al ticket:', error);
        await interaction.editReply({
            content: '❌ No se pudo agregar al usuario. Verifica los permisos.',
            ephemeral: true
        });
    }
}

async function handleStatus(interaction, client) {
    const openTickets = client.db.getOpenTickets();
    if (!openTickets || openTickets.length === 0) {
        return interaction.editReply({
            content: '📭 No hay tickets abiertos en este momento.',
            ephemeral: true
        });
    }

    const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('📊 Tickets Abiertos')
        .setDescription(openTickets.map(t => `• **#${t.ticket_number}** - <#${t.channel_id}> | Creador: <@${t.user_id}> | Staff: ${t.assigned_to ? `<@${t.assigned_to}>` : 'Sin asignar'}`).join('\n'))
        .setTimestamp();

    await interaction.editReply({
        embeds: [embed],
        ephemeral: true
    });
}

async function handleAssign(interaction, client) {
    const channelId = interaction.channel.id;
    const ticket = client.db.getTicketByChannel(channelId);

    if (!ticket) {
        return interaction.editReply({
            content: '❌ Este comando solo puede usarse en un canal de ticket.',
            ephemeral: true
        });
    }

    const assignedUser = interaction.options.getUser('usuario');
    client.db.assignTicket(ticket.ticket_number, assignedUser.id);

    await interaction.editReply({
        content: `✅ El ticket #${ticket.ticket_number} ha sido asignado a ${assignedUser}.`,
        ephemeral: true
    });

    await interaction.channel.send({
        content: `👤 **${interaction.user.tag}** ha asignado este ticket a ${assignedUser}.`
    });
}
