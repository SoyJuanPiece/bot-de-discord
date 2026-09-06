/**
 * Maneja las interacciones de select menus (placeholders)
 */
async function handleInteraction(interaction, client, action, params) {
    console.log(`Select menu interaction: ${action}`, params);
    
    // Placeholder para futuras implementaciones
    await interaction.deferUpdate();
}

module.exports = { handleInteraction };
