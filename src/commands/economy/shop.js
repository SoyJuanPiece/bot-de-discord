const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tienda')
        .setNameLocalizations({
            'en-US': 'shop',
            'pt-BR': 'loja'
        })
        .setDescription('🛒 Muestra el catálogo de la tienda'),
    
    cooldown: 10000,
    
    async execute(interaction, client) {
        const items = client.db.getAllShopItems();
        
        if (items.length === 0) {
            return interaction.reply({
                content: '❌ La tienda está vacía actualmente.',
                ephemeral: true
            });
        }
        
        // Obtener saldo del usuario
        const userData = client.db.getUser(interaction.user.id);
        const userCoins = userData ? userData.coins : 0;
        
        // Agrupar items por categoría
        const categories = {
            'role': { name: 'Roles', emoji: '👑', items: [] },
            'prefix': { name: 'Prefijos', emoji: '🏷️', items: [] },
            'crate': { name: 'Llaves de Crate', emoji: '🔑', items: [] },
            'cosmetic': { name: 'Cosméticos', emoji: '✨', items: [] }
        };
        
        for (const item of items) {
            if (categories[item.item_type]) {
                categories[item.item_type].items.push(item);
            }
        }
        
        // Crear embed principal
        const shopEmbed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle('🛒 Tienda de TitanBot')
            .setDescription(`
Bienvenido a la tienda oficial del servidor.

💰 **Tu Saldo:** ${userCoins.toLocaleString()} 🪙

Usa el menú desplegable para navegar por categorías o compra directamente con:
\`/comprar [item_id]\`
            `)
            .setThumbnail(interaction.guild?.iconURL() || interaction.client.user.displayAvatarURL())
            .setTimestamp();
        
        // Agregar campos por categoría
        for (const [key, category] of Object.entries(categories)) {
            if (category.items.length > 0) {
                let itemsList = '';
                for (const item of category.items.slice(0, 5)) { // Mostrar solo primeros 5
                    itemsList += `• **${item.name}** - ${item.price.toLocaleString()} 🪙\n`;
                }
                
                if (category.items.length > 5) {
                    itemsList += `_...y ${category.items.length - 5} más_`;
                }
                
                shopEmbed.addFields({
                    name: `${category.emoji} ${category.name} (${category.items.length})`,
                    value: itemsList || 'Sin items disponibles',
                    inline: false
                });
            }
        }
        
        // Crear botones de navegación (si hay muchas categorías)
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('shop_refresh')
                    .setLabel('🔄 Actualizar')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('shop_help')
                    .setLabel('❓ Ayuda')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.reply({
            embeds: [shopEmbed],
            components: [row]
        });
    }
};
