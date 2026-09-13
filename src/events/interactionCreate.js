const { Events, InteractionFlags } = require('discord.js');
const { handleInteraction: handleButton } = require('../utils/buttonHandler');
const { handleInteraction: handleSelect } = require('../utils/selectHandler');
const { handleInteraction: handleModal } = require('../utils/modalHandler');
const { sendLog } = require('../utils/logService');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) {
                console.error(`❌ Comando no encontrado: ${interaction.commandName}`);
                return;
            }
            try {
                if (command.cooldown) {
                    const cooldownResult = client.db.checkCooldown(interaction.user.id, command.data.name, command.cooldown);
                    if (!cooldownResult.canUse) {
                        return interaction.reply({ content: `⏳ Por favor espera **${cooldownResult.remainingSeconds}** segundos antes de usar este comando nuevamente.`, flags: InteractionFlags.Ephemeral });
                    }
                    client.db.setCooldown(interaction.user.id, command.data.name, command.cooldown);
                }
                await command.execute(interaction, client);
            } catch (error) {
                console.error('❌ Error ejecutando comando:', error.message);
                if (!interaction.replied && !interaction.deferred) {
                    try { await interaction.reply({ content: '❌ Ha ocurrido un error al ejecutar este comando.', flags: InteractionFlags.Ephemeral }); } catch (e) {}
                }
            }
        }

        if (interaction.isButton()) {
            try {
                const [action, ...params] = interaction.customId.split('_');
                await handleButton(interaction, client, action, params);
            } catch (error) {
                console.error('❌ Error manejando botón:', error.message);
                if (!interaction.replied && !interaction.deferred) {
                    try { await interaction.reply({ content: '❌ Ha ocurrido un error al procesar este botón.', flags: InteractionFlags.Ephemeral }); } catch (e) {}
                }
            }
        }

        if (interaction.isStringSelectMenu()) {
            try {
                const [action, ...params] = interaction.customId.split('_');
                await handleSelect(interaction, client, action, params);
            } catch (error) {
                console.error('❌ Error manejando select menu:', error);
            }
        }

        if (interaction.isModalSubmit()) {
            try {
                const [action, ...params] = interaction.customId.split('_');
                await handleModal(interaction, client, action, params);
            } catch (error) {
                console.error('❌ Error manejando modal:', error.message);
            }
        }

        if (interaction.isAutocomplete()) {
            const command = client.commands.get(interaction.commandName);
            if (command?.autocomplete) {
                try { await command.autocomplete(interaction); } catch (error) { console.error('❌ Error en autocomplete:', error.message); }
            }
        }
    }
};
