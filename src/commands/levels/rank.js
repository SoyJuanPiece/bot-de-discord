const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setNameLocalizations({
            'en-US': 'rank',
            'pt-BR': 'nivel'
        })
        .setDescription('📊 Muestra tu tarjeta de nivel actual y progreso')
        .addUserOption(option =>
            option
                .setName('usuario')
                .setDescription('Usuario para consultar (opcional)')
                .setRequired(false)
        ),
    
    cooldown: 5000, // 5 segundos
    
    async execute(interaction, client) {
        await interaction.deferReply();
        
        const targetUser = interaction.options.getUser('usuario') || interaction.user;
        const userId = targetUser.id;
        
        // Asegurar que el usuario existe en la BD
        client.db.ensureUser(userId, targetUser.username);
        
        // Obtener datos del usuario
        const userData = client.db.getUser(userId);
        
        if (!userData) {
            return interaction.editReply({
                content: '❌ No se pudo obtener la información del usuario.'
            });
        }
        
        // Calcular XP necesaria para el siguiente nivel
        // Fórmula: xp_necesaria = (nivel + 1)^2 * 100
        const nextLevelXp = Math.pow(userData.level + 1, 2) * 100;
        const currentLevelMinXp = Math.pow(userData.level, 2) * 100;
        const xpForNextLevel = nextLevelXp - currentLevelMinXp;
        const xpProgress = userData.xp - currentLevelMinXp;
        const progressPercent = Math.min(100, Math.max(0, (xpProgress / xpForNextLevel) * 100));
        
        // Calcular posición en el ranking
        const allUsers = client.db.getTopUsers(1000);
        const userRank = allUsers.findIndex(u => u.user_id === userId) + 1;
        
        // Crear embed con la tarjeta de nivel
        const rankEmbed = new EmbedBuilder()
            .setColor(0x00ff88)
            .setAuthor({
                name: `Perfil de ${targetUser.username}`,
                iconURL: targetUser.displayAvatarURL()
            })
            .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
            .addFields(
                {
                    name: '🏆 Nivel',
                    value: `**${userData.level}**`,
                    inline: true
                },
                {
                    name: '⭐ XP Total',
                    value: `**${userData.xp.toLocaleString()}**`,
                    inline: true
                },
                {
                    name: '🪙 Monedas',
                    value: `**${userData.coins.toLocaleString()}**`,
                    inline: true
                },
                {
                    name: '📈 Progreso',
                    value: `${xpProgress.toLocaleString()} / ${xpForNextLevel.toLocaleString()} XP`,
                    inline: false
                },
                {
                    name: '📊 Barra de Progreso',
                    value: createProgressBar(progressPercent),
                    inline: false
                },
                {
                    name: '🥇 Ranking Global',
                    value: `**#${userRank}** de ${allUsers.length} usuarios`,
                    inline: true
                },
                {
                    name: '💬 Mensajes',
                    value: `**${userData.messages_sent}**`,
                    inline: true
                },
                {
                    name: '🎤 Voz',
                    value: `**${userData.voice_minutes}** min`,
                    inline: true
                }
            )
            .setFooter({
                text: `TitanBot • ID: ${userId}`
            })
            .setTimestamp();
        
        await interaction.editReply({
            embeds: [rankEmbed]
        });
    }
};

/**
 * Crea una barra de progreso visual
 */
function createProgressBar(percent) {
    const totalBlocks = 10;
    const filledBlocks = Math.round((percent / 100) * totalBlocks);
    const emptyBlocks = totalBlocks - filledBlocks;
    
    return `[${'▓'.repeat(filledBlocks)}${'░'.repeat(emptyBlocks)}] ${percent.toFixed(1)}%`;
}
