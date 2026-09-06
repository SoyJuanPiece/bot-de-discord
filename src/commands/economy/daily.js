const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('diario')
        .setNameLocalizations({
            'en-US': 'daily',
            'pt-BR': 'diario'
        })
        .setDescription('🎁 Reclama tu bonificación diaria de monedas'),
    
    cooldown: 1000, // 1 segundo (el cooldown real lo maneja la BD - 24 horas)
    
    async execute(interaction, client) {
        const userId = interaction.user.id;
        const username = interaction.user.username;
        
        client.db.ensureUser(userId, username);
        
        const userData = client.db.getUser(userId);
        const now = Math.floor(Date.now() / 1000);
        const oneDayInSeconds = 24 * 60 * 60; // 24 horas
        
        // Verificar si ya reclamó el diario hoy
        if (userData.daily_claimed_at) {
            const timeSinceClaim = now - userData.daily_claimed_at;
            
            if (timeSinceClaim < oneDayInSeconds) {
                const remainingSeconds = oneDayInSeconds - timeSinceClaim;
                const hours = Math.floor(remainingSeconds / 3600);
                const minutes = Math.floor((remainingSeconds % 3600) / 60);
                const seconds = remainingSeconds % 60;
                
                return interaction.reply({
                    content: `⏳ Ya has reclamado tu diario recientemente. Vuelve en **${hours}h ${minutes}m ${seconds}s**.`,
                    ephemeral: true
                });
            }
        }
        
        // Calcular recompensa (puede aumentar con el nivel)
        const baseReward = parseInt(process.env.DAILY_REWARD_AMOUNT) || 100;
        const levelBonus = Math.floor(userData.level * 5); // 5 monedas extra por nivel
        const totalReward = baseReward + levelBonus;
        
        // Añadir monedas al usuario
        client.db.claimDaily(userId, totalReward);
        
        const dailyEmbed = new EmbedBuilder()
            .setColor(0x00ff88)
            .setAuthor({
                name: `¡Diario Reclamado!`,
                iconURL: interaction.user.displayAvatarURL()
            })
            .setDescription(`
🎁 **${username}**, has reclamado tu recompensa diaria!

💰 **Recompensa Base:** ${baseReward} 🪙
⭐ **Bono de Nivel:** +${levelBonus} 🪙 (Nivel ${userData.level})
━━━━━━━━━━━━━━━━━━━━━━
🎊 **Total:** ${totalReward} 🪙
            `)
            .addFields(
                {
                    name: '📅 Próximo Diario',
                    value: 'Disponible en 24 horas',
                    inline: false
                },
                {
                    name: '💡 Consejo',
                    value: '¡Sigue activo y sube de nivel para obtener mayores recompensas!',
                    inline: false
                }
            )
            .setFooter({
                text: 'TitanBot Economy System'
            })
            .setTimestamp();
        
        await interaction.reply({
            embeds: [dailyEmbed]
        });
    }
};
