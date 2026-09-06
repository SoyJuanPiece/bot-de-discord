const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('comprar')
        .setNameLocalizations({
            'en-US': 'buy',
            'pt-BR': 'comprar'
        })
        .setDescription('🛒 Compra un item de la tienda')
        .addIntegerOption(option =>
            option
                .setName('item_id')
                .setDescription('ID del item a comprar')
                .setRequired(true)
                .setMinValue(1)
        ),
    
    cooldown: 5000,
    
    async execute(interaction, client) {
        const itemId = interaction.options.getInteger('item_id');
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        
        // Asegurar que el usuario existe
        client.db.ensureUser(userId, interaction.user.username);
        
        // Obtener datos del usuario y del item
        const userData = client.db.getUser(userId);
        const item = client.db.getShopItem(itemId);
        
        if (!item) {
            return interaction.reply({
                content: '❌ Ese item no existe en la tienda.',
                ephemeral: true
            });
        }
        
        if (!item.enabled) {
            return interaction.reply({
                content: '❌ Ese item no está disponible actualmente.',
                ephemeral: true
            });
        }
        
        // Verificar saldo
        if (userData.coins < item.price) {
            const missing = item.price - userData.coins;
            return interaction.reply({
                content: `❌ **Saldo insuficiente.**\n\n💰 Tu saldo: ${userData.coins.toLocaleString()} 🪙\n💵 Precio: ${item.price.toLocaleString()} 🪙\n📉 Te faltan: **${missing.toLocaleString()} 🪙**`,
                ephemeral: true
            });
        }
        
        // Procesar compra
        try {
            // Deducir monedas
            client.db.db.prepare(`
                UPDATE users SET coins = coins - ? WHERE user_id = ?
            `).run(item.price, userId);
            
            // Registrar compra
            client.db.recordPurchase(userId, item.id, item.name, item.price);
            
            // Entregar item según tipo
            let deliveryMessage = '';
            
            switch (item.item_type) {
                case 'role':
                    if (item.role_id && item.role_id !== 'vip_role_placeholder') {
                        const role = await interaction.guild.roles.fetch(item.role_id).catch(() => null);
                        if (role) {
                            const member = await interaction.guild.members.fetch(userId);
                            await member.roles.add(role).catch(() => {});
                            deliveryMessage = `✅ Se te ha otorgado el rol **${item.name}**.`;
                        } else {
                            deliveryMessage = `⚠️ El rol configurado no existe. Un administrador debe configurarlo.\n\n🎫 Abre un ticket para reclamar tu compra.`;
                        }
                    } else {
                        deliveryMessage = `⚠️ Este rol necesita configuración. Abre un ticket para reclamar.`;
                    }
                    break;
                    
                case 'prefix':
                    if (item.prefix_name) {
                        client.db.unlockPrefix(userId, item.prefix_name);
                        deliveryMessage = `✅ Has desbloqueado el prefijo **[${item.prefix_name}]**.\n\nUsa \\\`/prefijo equipar ${item.prefix_name}\\\` para usarlo.`;
                    }
                    break;
                    
                case 'crate':
                    if (item.crate_key) {
                        // Guardar la llave en la base de datos
                        client.db.db.prepare(`
                            INSERT INTO purchases (user_id, item_id, item_name, price_paid, delivered)
                            VALUES (?, ?, ?, ?, 1)
                        `).run(userId, item.id, `${item.crate_key}_key`, item.price);
                        
                        deliveryMessage = `✅ Has recibido una **${item.name}**.\n\nVe al spawn del servidor de Minecraft para abrir los crates.`;
                    }
                    break;
                    
                case 'cosmetic':
                    deliveryMessage = `✅ Has comprado **${item.name}**.\n\n🎫 Abre un ticket en la categoría **Tienda** para que un administrador configure tu cosmético en el servidor.`;
                    break;
                    
                default:
                    deliveryMessage = `✅ Compra completada. Un administrador te contactará para la entrega.`;
            }
            
            // Crear embed de confirmación
            const purchaseEmbed = new EmbedBuilder()
                .setColor(0x00ff88)
                .setTitle('✅ ¡Compra Exitosa!')
                .setThumbnail(interaction.user.displayAvatarURL())
                .addFields(
                    {
                        name: '📦 Item',
                        value: item.name,
                        inline: true
                    },
                    {
                        name: '💵 Precio',
                        value: `${item.price.toLocaleString()} 🪙`,
                        inline: true
                    },
                    {
                        name: '💰 Saldo Restante',
                        value: `${(userData.coins - item.price).toLocaleString()} 🪙`,
                        inline: true
                    },
                    {
                        name: '📬 Entrega',
                        value: deliveryMessage,
                        inline: false
                    }
                )
                .setFooter({
                    text: `Transacción #${Date.now().toString().slice(-6)} • TitanBot Shop`
                })
                .setTimestamp();
            
            // Notificar en canal de logs si está configurado
            const logChannelId = process.env.LOG_CHANNEL_ID;
            if (logChannelId) {
                const logChannel = await client.channels.fetch(logChannelId).catch(() => null);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setColor(0xffd700)
                        .setTitle('🛒 Nueva Compra en Tienda')
                        .addFields(
                            { name: '👤 Usuario', value: `${interaction.user.tag} (${userId})`, inline: true },
                            { name: '📦 Item', value: `${item.name} (ID: ${item.id})`, inline: true },
                            { name: '💵 Precio', value: `${item.price.toLocaleString()} 🪙`, inline: true }
                        )
                        .setTimestamp();
                    
                    await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
                }
            }
            
            await interaction.reply({
                embeds: [purchaseEmbed],
                ephemeral: false
            });
            
        } catch (error) {
            console.error('❌ Error procesando compra:', error);
            
            // Reembolsar en caso de error
            client.db.db.prepare(`
                UPDATE users SET coins = coins + ? WHERE user_id = ?
            `).run(item.price, userId);
            
            await interaction.reply({
                content: `❌ Ha ocurrido un error procesando tu compra. Tus monedas han sido reembolsadas.\n\n🎫 Por favor abre un ticket si el problema persiste.`,
                ephemeral: true
            });
        }
    }
};
