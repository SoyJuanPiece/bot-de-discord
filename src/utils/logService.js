const { EmbedBuilder } = require('discord.js');

async function sendLog(client, guildId, title, fields, transcriptContent) {
    const guildConfig = client.db.getGuildConfig(guildId);
    if (!guildConfig?.log_channel) return;

    const logChannel = await client.channels.fetch(guildConfig.log_channel).catch(() => null);
    if (!logChannel) return;

    const logEmbed = new EmbedBuilder()
        .setColor(0xff4444)
        .setTitle(title)
        .addFields(fields)
        .setTimestamp();

    const content = transcriptContent && transcriptContent.length > 2000
        ? transcriptContent.slice(0, 1997) + '...'
        : transcriptContent;

    if (logChannel.type === 15) {
        await logChannel.threads.create({
            name: title,
            message: { embeds: [logEmbed], content: content ? `\`\`\`\n${content}\n\`\`\`` : undefined }
        }).catch(() => null);
    } else {
        await logChannel.send({ embeds: [logEmbed], content: content ? `\`\`\`\n${content}\n\`\`\`` : undefined }).catch(() => null);
    }
}

async function sendPurchaseLog(client, guildId, userTag, userId, itemName, itemId, price) {
    const guildConfig = client.db.getGuildConfig(guildId);
    if (!guildConfig?.log_channel) return;

    const logChannel = await client.channels.fetch(guildConfig.log_channel).catch(() => null);
    if (!logChannel) return;

    const logEmbed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle('🛒 Nueva Compra en Tienda')
        .addFields(
            { name: '👤 Usuario', value: `${userTag} (${userId})`, inline: true },
            { name: '📦 Item', value: `${itemName} (ID: ${itemId})`, inline: true },
            { name: '💵 Precio', value: `${price.toLocaleString()} 🪙`, inline: true }
        )
        .setTimestamp();

    await logChannel.send({ embeds: [logEmbed] }).catch(() => null);
}

module.exports = { sendLog, sendPurchaseLog };
