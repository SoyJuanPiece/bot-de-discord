const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('top')
        .setNameLocalizations({
            'en-US': 'top',
            'pt-BR': 'lideres'
        })
        .setDescription('🏆 Muestra el ranking de los usuarios más activos')
        .addStringOption(option =>
            option
                .setName('tipo')
                .setDescription('Tipo de ranking a mostrar')
                .setRequired(false)
                .addChoices(
                    { name: 'XP General', value: 'xp' },
                    { name: 'Nivel', value: 'level' },
                    { name: 'Monedas', value: 'coins' },
                    { name: 'Mensajes', value: 'messages' }
                )
        )
        .addIntegerOption(option =>
            option
                .setName('cantidad')
                .setDescription('Número de usuarios a mostrar (máx 20)')
                .setMinValue(1)
                .setMaxValue(20)
                .setRequired(false)
        ),
    
    cooldown: 10000, // 10 segundos
    
    async execute(interaction, client) {
        await interaction.deferReply();
        
        const tipo = interaction.options.getString('tipo') || 'xp';
        const cantidad = interaction.options.getInteger('cantidad') || 10;
        
        // Obtener todos los usuarios ordenados por XP
        const allUsers = client.db.getTopUsers(100);
        
        if (allUsers.length === 0) {
            return interaction.editReply({
                content: '❌ No hay usuarios registrados en el sistema de niveles.'
            });
        }
        
        // Ordenar según el tipo seleccionado
        let sortedUsers = [...allUsers];
        let rankingType = 'XP';
        let emoji = '⭐';
        
        switch (tipo) {
            case 'level':
                sortedUsers.sort((a, b) => b.level - a.level);
                rankingType = 'Nivel';
                emoji = '🏆';
                break;
            case 'coins':
                sortedUsers.sort((a, b) => b.coins - a.coins);
                rankingType = 'Monedas';
                emoji = '🪙';
                break;
            case 'messages':
                sortedUsers = client.db._all('SELECT * FROM users ORDER BY messages_sent DESC LIMIT ?', [cantidad]);
                rankingType = 'Mensajes';
                emoji = '💬';
                break;
            default:
                // Ya vienen ordenados por XP desde la BD
                break;
        }
        
        // Tomar solo la cantidad solicitada
        const topUsers = sortedUsers.slice(0, cantidad);
        
        // Crear el embed del leaderboard
        const leaderboardEmbed = new EmbedBuilder()
            .setColor(0xffd700)
            .setTitle(`${emoji} Top ${rankingType} - TitanBot`)
            .setDescription('Los usuarios más activos del servidor')
            .setTimestamp();
        
        // Construir la lista de usuarios
        let description = '';
        for (let i = 0; i < topUsers.length; i++) {
            const user = topUsers[i];
            const rank = i + 1;
            
            // Emojis especiales para top 3
            let rankEmoji = `${rank}.`;
            if (rank === 1) rankEmoji = '🥇';
            else if (rank === 2) rankEmoji = '🥈';
            else if (rank === 3) rankEmoji = '🥉';
            
            // Obtener el nombre del usuario
            try {
                const discordUser = await client.users.fetch(user.user_id);
                const username = discordUser.username;
                
                let statValue;
                switch (tipo) {
                    case 'level':
                        statValue = `Nivel ${user.level}`;
                        break;
                    case 'coins':
                        statValue = `${user.coins.toLocaleString()} 🪙`;
                        break;
                    case 'messages':
                        statValue = `${user.messages_sent} 💬`;
                        break;
                    default:
                        statValue = `${user.xp.toLocaleString()} XP`;
                }
                
                description += `${rankEmoji} **${username}** - ${statValue}\n`;
            } catch (error) {
                // Si no se puede fetchear el usuario, usar el nombre guardado
                description += `${rankEmoji} **${user.username || 'Usuario'}** - ${user.xp.toLocaleString()} XP\n`;
            }
        }
        
        leaderboardEmbed.setDescription(description);
        
        // Agregar footer con estadísticas
        leaderboardEmbed.setFooter({
            text: `Total de usuarios: ${allUsers.length} • Actualizado: ${new Date().toLocaleDateString('es-ES')}`
        });
        
        await interaction.editReply({
            embeds: [leaderboardEmbed]
        });
    }
};
