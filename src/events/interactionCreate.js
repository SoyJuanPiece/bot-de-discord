const { Events } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        // Manejo de comandos slash
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`❌ Comando no encontrado: ${interaction.commandName}`);
                return;
            }

            try {
                // Verificar cooldown si el comando lo tiene configurado
                if (command.cooldown) {
                    const cooldownResult = client.db.checkCooldown(
                        interaction.user.id,
                        command.data.name,
                        command.cooldown
                    );

                    if (!cooldownResult.canUse) {
                        return interaction.reply({
                            content: `⏳ Por favor espera **${cooldownResult.remainingSeconds}** segundos antes de usar este comando nuevamente.`,
                            ephemeral: true
                        });
                    }

                    // Establecer cooldown
                    client.db.setCooldown(
                        interaction.user.id,
                        command.data.name,
                        command.cooldown
                    );
                }

                await command.execute(interaction, client);
            } catch (error) {
                console.error('❌ Error ejecutando comando:', error);
                
                const errorMessage = {
                    content: '❌ Ha ocurrido un error al ejecutar este comando.',
                    ephemeral: true
                };

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorMessage);
                } else {
                    await interaction.reply(errorMessage);
                }
            }
        }

        // Manejo de botones
        if (interaction.isButton()) {
            try {
                const [action, ...params] = interaction.customId.split('_');
                
                // Delegar al manejador de botones
                const buttonHandler = require('../utils/buttonHandler');
                await buttonHandler.handleInteraction(interaction, client, action, params);
            } catch (error) {
                console.error('❌ Error manejando botón:', error);
                
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ Ha ocurrido un error al procesar este botón.',
                        ephemeral: true
                    });
                }
            }
        }

        // Manejo de select menus
        if (interaction.isStringSelectMenu()) {
            try {
                const [action, ...params] = interaction.customId.split('_');
                
                // Delegar al manejador de select menus
                const selectHandler = require('../utils/selectHandler');
                await selectHandler.handleInteraction(interaction, client, action, params);
            } catch (error) {
                console.error('❌ Error manejando select menu:', error);
            }
        }

        // Manejo de modales
        if (interaction.isModalSubmit()) {
            try {
                const [action, ...params] = interaction.customId.split('_');
                
                // Delegar al manejador de modales
                const modalHandler = require('../utils/modalHandler');
                await modalHandler.handleInteraction(interaction, client, action, params);
            } catch (error) {
                console.error('❌ Error manejando modal:', error);
            }
        }
    }
};
