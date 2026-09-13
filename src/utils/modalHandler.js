const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');

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
    const reason = interaction.fields.getTextInputValue('close_reason');
    
    const ticket = client.db.getTicketByChannel(interaction.channel.id);
    
    if (!ticket) {
        return interaction.reply({
            content: '❌ Este ticket no existe en la base de datos.',
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
    transcript += `Razón: ${reason || 'Sin razón'}\n`;
    transcript += '═'.repeat(50) + '\n\n';
    
    for (const msg of messages) {
        const timestamp = `<t:${Math.floor(msg.createdTimestamp / 1000)}:t>`;
        transcript += `[${timestamp}] ${msg.author.tag}: ${msg.content || '(sin texto)'}\n`;
        if (msg.attachments.size > 0) {
            msg.attachments.forEach(a => transcript += `  📎 Adjunto: ${a.name}\n`);
        }
    }
    
    client.db.closeTicket(interaction.channel.id, reason || 'Sin razón especificada', interaction.user.tag);
    
    const closeEmbed = new EmbedBuilder()
        .setColor(0xff4444)
        .setTitle('🔒 Ticket Cerrado')
        .setDescription(`
**Ticket #${ticket.ticket_number}** ha sido cerrado.

📝 **Razón:** ${reason || 'Sin razón especificada'}
👤 **Cerrado por:** ${interaction.user.tag}
🕐 **Fecha:** <t:${Math.floor(Date.now() / 1000)}:F>
        `)
        .setFooter({ text: 'Gracias por usar nuestro sistema de soporte' })
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
                    { name: '📝 Razón', value: reason || 'Sin razón', inline: false }
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
    
    await interaction.reply({
        content: '✅ El ticket será cerrado en 5 segundos...',
        ephemeral: true
    });
    
    setTimeout(async () => {
        try {
            await interaction.channel.delete();
        } catch (error) {
            console.error('Error cerrando ticket:', error);
        }
    }, 5000);
}

async function handleCreateTicketFromPanel(interaction, client, categoria) {
    const motivo = interaction.fields.getTextInputValue('ticket_reason');
    const userId = interaction.user.id;
    const guild = interaction.guild;
    
    const existingTicket = client.db._get(
        'SELECT * FROM tickets WHERE user_id = ? AND status = \'open\'',
        [userId]
    );
    
    if (existingTicket) {
        const channel = await guild.channels.fetch(existingTicket.channel_id).catch(() => null);
        if (channel) {
            return interaction.reply({
                content: `❌ Ya tienes un ticket abierto: <#${existingTicket.channel_id}>`,
                ephemeral: true
            });
        }
        client.db._run('UPDATE tickets SET status = \'closed\', closed_reason = \'Canal eliminado\' WHERE id = ?', [existingTicket.id]);
    }
    
    await interaction.deferReply({ ephemeral: true });
    
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
                { id: guild.roles.everyone, deny: ['ViewChannel'] },
                { id: client.user.id, allow: ['ViewChannel', 'ManageChannels', 'SendMessages'] }
            ]
        }).catch(() => null);
    }
    
    const ticketStaffRole = client.db.getGuildConfig(guild.id)?.ticket_staff_role;
    const permissionOverwrites = [
        { id: guild.roles.everyone, deny: ['ViewChannel'] },
        { id: userId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
        { id: client.user.id, allow: ['ViewChannel', 'SendMessages', 'ManageMessages'] }
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
            content: '❌ No se pudo crear el canal del ticket. Contacta a un administrador.'
        });
    }
    
    client.db.createTicket(ticketNumber, ticketChannel.id, userId, categoria, motivo, interaction.user.tag);
    
    const categoriaNombres = {
        'soporte_general': '📞 Soporte General',
        'reportes': '⚠️ Reportes (Hacks/Griefing)',
        'tienda': '🛒 Tienda/Compras',
        'apelaciones': '⚖️ Apelaciones de Ban/Mute'
    };
    
    const ticketEmbed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('🎫 Ticket Creado')
        .setDescription(`
**Ticket #${ticketNumber}**
━━━━━━━━━━━━━━━━━━━━━━
👤 **Creado por:** ${interaction.user}
📂 **Categoría:** ${categoriaNombres[categoria] || categoria}
📝 **Motivo:** ${motivo}
🕐 **Fecha:** <t:${Math.floor(Date.now() / 1000)}:F>
        `)
        .setFooter({ text: `ID del Ticket: ${ticketNumber} • TitanBot Support` })
        .setTimestamp();
    
    const closeRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`ticket_close_${ticketNumber}`)
                .setLabel('🔒 Cerrar Ticket')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`ticket_add_${ticketNumber}`)
                .setLabel('➕ Agregar Usuario')
                .setStyle(ButtonStyle.Primary)
        );
    
    await ticketChannel.send({
        content: `👋 ${interaction.user}, bienvenido a tu ticket de soporte. Un miembro del Staff te atenderá pronto.`,
        embeds: [ticketEmbed],
        components: [closeRow]
    });
    
     await interaction.editReply({
         content: `✅ Tu ticket ha sido creado: ${ticketChannel}`
     });
}

module.exports = { handleInteraction };
