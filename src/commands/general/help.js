const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('📚 Muestra todos los comandos disponibles y ayuda del bot'),
    
    cooldown: 10000,
    
    async execute(interaction, client) {
        const helpEmbed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle('🤖 TitanBot - Centro de Ayuda')
            .setDescription(`
Bienvenido al sistema de ayuda de **TitanBot**, tu bot de administración para Discord y Minecraft.

**Prefijo:** No requiere prefijo (comandos slash)
**Versión:** 1.0.0
            `)
            .setThumbnail(client.user.displayAvatarURL())
            .setTimestamp();
        
        // Comandos de Niveles
        helpEmbed.addFields({
            name: '🏆 Sistema de Niveles',
            value: '`/rank` - Ver tu nivel y progreso\n`/top` - Ranking de usuarios activos',
            inline: false
        });
        
        // Comandos de Economía
        helpEmbed.addFields({
            name: '💰 Economía y Tienda',
            value: '`/saldo` - Ver tus monedas\n`/diario` - Reclamar recompensa diaria\n`/tienda` - Ver catálogo de items\n`/comprar [id]` - Comprar un item',
            inline: false
        });
        
        // Comandos de Tickets
        helpEmbed.addFields({
            name: '🎫 Sistema de Tickets',
            value: '`/ticket crear [categoría] [motivo]` - Abrir ticket\n`/ticket cerrar [razón]` - Cerrar ticket\n`/ticket agregar [@usuario]` - Agregar usuario al ticket',
            inline: false
        });
        
        // Comandos de Prefijos
        helpEmbed.addFields({
            name: '🏷️ Sistema de Prefijos',
            value: '`/prefijos lista` - Ver prefijos disponibles\n`/prefijos equipar [nombre]` - Equipar prefijo\n`/prefijos remover` - Quitar prefijo',
            inline: false
        });
        
        // Comandos de Moderación (solo visibles para staff)
        const isStaff = interaction.member.permissions.has('ModerateMembers');
        const modCommands = isStaff 
            ? '`/warn [@usuario] [motivo]` - Advertir usuario\n`/mute [@usuario] [tiempo] [motivo]` - Silenciar temporalmente\n`/kick [@usuario] [motivo]` - Expulsar del servidor\n`/ban [@usuario] [motivo]` - Banear permanentemente'
            : '🔒 Solo visible para personal con permisos de moderación';
        
        helpEmbed.addFields({
            name: '🛡️ Moderación',
            value: modCommands,
            inline: false
        });
        
        // Información adicional
        helpEmbed.addFields({
            name: '📌 Información Importante',
            value: `• Los tickets se cierran automáticamente después de ser atendidos
• Las sanciones por hacks/exploits son permanentes
• Para soporte técnico o reembolsos, usa la categoría **Tienda** en tickets
• Nunca compartas información confidencial (contraseñas, tokens, etc.)`,
            inline: false
        });
        
        // Footer con estadísticas
        helpEmbed.setFooter({
            text: `Servidores: ${client.guilds.cache.size} • Usuarios: ${client.users.cache.size}`
        });
        
        await interaction.reply({
            embeds: [helpEmbed],
            ephemeral: true
        });
    }
};
