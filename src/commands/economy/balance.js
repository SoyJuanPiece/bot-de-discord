const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('saldo')
        .setNameLocalizations({
            'en-US': 'balance',
            'pt-BR': 'saldo'
        })
        .setDescription('🪙 Muestra tu saldo de monedas actual')
        .addUserOption(option =>
            option
                .setName('usuario')
                .setDescription('Usuario para consultar (opcional)')
                .setRequired(false)
        ),
    
    cooldown: 5000,
    
    async execute(interaction, client) {
        const targetUser = interaction.options.getUser('usuario') || interaction.user;
        const userId = targetUser.id;
        
        client.db.ensureUser(userId, targetUser.username);
        
        const userData = client.db.getUser(userId);
        
        if (!userData) {
            return interaction.reply({
                content: '❌ No se pudo obtener la información del usuario.',
                ephemeral: true
            });
        }
        
        const balanceEmbed = new EmbedBuilder()
            .setColor(0xffd700)
            .setAuthor({
                name: `Saldo de ${targetUser.username}`,
                iconURL: targetUser.displayAvatarURL()
            })
            .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
            .addFields(
                {
                    name: '💰 Monedas Actuales',
                    value: `**${userData.coins.toLocaleString()} 🪙**`,
                    inline: false
                },
                {
                    name: '📊 Nivel',
                    value: `${userData.level}`,
                    inline: true
                },
                {
                    name: '⭐ XP',
                    value: `${userData.xp.toLocaleString()}`,
                    inline: true
                },
                {
                    name: '🎁 Último Diario',
                    value: userData.daily_claimed_at 
                        ? `<t:${userData.daily_claimed_at}:R>`
                        : 'No reclamado',
                    inline: true
                }
            )
            .setFooter({
                text: 'Usa /diario para reclamar tus monedas diarias'
            })
            .setTimestamp();
        
        await interaction.reply({
            embeds: [balanceEmbed]
        });
    }
};
