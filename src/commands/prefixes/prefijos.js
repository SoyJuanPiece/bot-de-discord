const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('prefijos')
        .setDescription('🏷️ Gestiona tus prefijos de usuario')
        .addSubcommand(subcommand =>
            subcommand
                .setName('lista')
                .setDescription('📋 Muestra todos los prefijos disponibles y los tuyos')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('equipar')
                .setDescription('⚔️ Equipa un prefijo desbloqueado')
                .addStringOption(option =>
                    option
                        .setName('nombre_prefijo')
                        .setDescription('Nombre del prefijo a equipar')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remover')
                .setDescription('❌ Remueve tu prefijo actual')
        ),
    
    cooldown: 5000,
    
    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'lista') {
            await handleListaPrefijos(interaction, client);
        } else if (subcommand === 'equipar') {
            await handleEquiparPrefijo(interaction, client);
        } else if (subcommand === 'remover') {
            await handleRemoverPrefijo(interaction, client);
        }
    }
};

async function handleListaPrefijos(interaction, client) {
    const userId = interaction.user.id;
    
    // Asegurar que el usuario existe
    client.db.ensureUser(userId, interaction.user.username);
    
    // Obtener prefijos del usuario
    const userPrefixes = client.db.getUserPrefixes(userId);
    const activePrefix = client.db.getActivePrefix(userId);
    
    // Lista completa de prefijos disponibles
    const allPrefixes = [
        { name: 'Novato', level: 5, type: 'nivel', emoji: '🌱' },
        { name: 'Aprendiz', level: 10, type: 'nivel', emoji: '📚' },
        { name: 'Experto', level: 20, type: 'nivel', emoji: '⭐' },
        { name: 'Veterano', level: 30, type: 'nivel', emoji: '🎖️' },
        { name: 'Elite', level: 50, type: 'nivel', emoji: '💎' },
        { name: 'Maestro', level: 75, type: 'nivel', emoji: '🔥' },
        { name: 'Leyenda', level: 100, type: 'nivel', emoji: '👑' },
        { name: 'VIP', level: 0, type: 'rol', emoji: '💰' },
        { name: 'Staff', level: 0, type: 'rol', emoji: '🛡️' },
        { name: 'Admin', level: 0, type: 'rol', emoji: '⚡' }
    ];
    
    // Prefijos desbloqueados por el usuario
    const unlockedNames = userPrefixes.map(p => p.prefix_name);
    
    // Crear embed
    const userData = client.db.getUser(userId);
    
    const prefixesEmbed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('🏷️ Sistema de Prefijos - TitanBot')
        .setDescription(`
**Tu Progreso:**
Nivel Actual: **${userData.level}**
Prefijo Activo: **${activePrefix ? `[${activePrefix.prefix_name}]` : 'Ninguno'}**
        `)
        .setThumbnail(interaction.user.displayAvatarURL())
        .setTimestamp();
    
    // Prefijos desbloqueados
    if (unlockedNames.length > 0) {
        prefixesEmbed.addFields({
            name: '✅ Tus Prefijos Desbloqueados',
            value: unlockedNames.map(n => `• [${n}]`).join('\n') || 'Ninguno',
            inline: false
        });
    }
    
    // Prefijos por nivel
    const levelPrefixes = allPrefixes.filter(p => p.type === 'nivel');
    let levelPrefixText = '';
    for (const prefix of levelPrefixes) {
        const unlocked = unlockedNames.includes(prefix.name);
        const progress = userData.level >= prefix.level ? '✅' : '🔒';
        levelPrefixText += `${progress} ${prefix.emoji} **[${prefix.name}]** - Nivel ${prefix.level}\n`;
    }
    prefixesEmbed.addFields({
        name: '📊 Prefijos por Nivel',
        value: levelPrefixText,
        inline: true
    });
    
    // Prefijos por rol/tienda
    const rolePrefixes = allPrefixes.filter(p => p.type === 'rol');
    let rolePrefixText = '';
    for (const prefix of rolePrefixes) {
        const unlocked = unlockedNames.includes(prefix.name);
        const status = unlocked ? '✅' : '🛒 Tienda';
        rolePrefixText += `${status} ${prefix.emoji} **[${prefix.name}]**\n`;
    }
    prefixesEmbed.addFields({
        name: '👑 Prefijos Especiales',
        value: rolePrefixText,
        inline: true
    });
    
    // Instrucciones
    prefixesEmbed.addFields({
        name: '💡 Cómo Usar',
        value: 'Usa `/prefijo equipar [nombre]` para cambiar tu prefijo\nUsa `/prefijo remover` para quitarlo',
        inline: false
    });
    
    await interaction.reply({
        embeds: [prefixesEmbed],
        ephemeral: true
    });
}

async function handleEquiparPrefijo(interaction, client) {
    const prefixName = interaction.options.getString('nombre_prefijo');
    const userId = interaction.user.id;
    
    // Asegurar que el usuario existe
    client.db.ensureUser(userId, interaction.user.username);
    
    // Verificar que el usuario tiene desbloqueado este prefijo
    const userPrefixes = client.db.getUserPrefixes(userId);
    const hasPrefix = userPrefixes.some(p => p.prefix_name.toLowerCase() === prefixName.toLowerCase());
    
    if (!hasPrefix) {
        return interaction.reply({
            content: `❌ No has desbloqueado el prefijo **[${prefixName}]**.\n\nUsa \\\`/prefijos\\\` para ver qué prefijos tienes disponibles.`,
            ephemeral: true
        });
    }
    
    // Obtener el nombre exacto (case-insensitive)
    const exactPrefixName = userPrefixes.find(p => p.prefix_name.toLowerCase() === prefixName.toLowerCase()).prefix_name;
    
    // Equipar prefijo
    client.db.setActivePrefix(userId, exactPrefixName);
    
    // Intentar actualizar el nickname en Discord
    try {
        const member = await interaction.guild.members.fetch(userId);
        
        // Obtener nombre base (sin prefijo anterior)
        const currentNick = member.nickname || member.user.username;
        const oldPrefixMatch = currentNick.match(/^\[([^\]]+)\]\s*(.*)/);
        const baseName = oldPrefixMatch ? oldPrefixMatch[2] : currentNick;
        
        // Nuevo nickname con prefijo
        const newNickname = `[${exactPrefixName}] ${baseName}`;
        
        // Verificar longitud máxima (32 caracteres en Discord)
        if (newNickname.length <= 32) {
            await member.setNickname(newNickname);
        } else {
            // Acortar nombre base si es necesario
            const maxBaseLength = 32 - exactPrefixName.length - 3; // 3 para [], espacio
            const shortenedName = baseName.slice(0, maxBaseLength);
            await member.setNickname(`[${exactPrefixName}] ${shortenedName}`);
        }
    } catch (error) {
        console.error('Error actualizando nickname:', error);
        // Continuar aunque falle la actualización del nickname
    }
    
    await interaction.reply({
        content: `✅ Has equipado el prefijo **[${exactPrefixName}]**.\n\nTu apodo ha sido actualizado.`,
        ephemeral: false
    });
}

async function handleRemoverPrefijo(interaction, client) {
    const userId = interaction.user.id;
    
    // Remover prefijo activo de la BD
    client.db.removeActivePrefix(userId);
    
    // Intentar actualizar el nickname en Discord
    try {
        const member = await interaction.guild.members.fetch(userId);
        const currentNick = member.nickname || member.user.username;
        
        // Remover prefijo del nickname
        const prefixMatch = currentNick.match(/^\[([^\]]+)\]\s*(.*)/);
        if (prefixMatch && prefixMatch[2]) {
            await member.setNickname(prefixMatch[2]);
        } else {
            // Si no hay prefijo, dejar el nombre base o username
            await member.setNickname(member.user.username);
        }
    } catch (error) {
        console.error('Error removiendo nickname:', error);
    }
    
    await interaction.reply({
        content: '✅ Tu prefijo ha sido removido.',
        ephemeral: false
    });
}
