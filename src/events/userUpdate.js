const { Events } = require('discord.js');
const { applyTargetPrefix } = require('../utils/nicknameService');

module.exports = {
    name: Events.UserUpdate,
    async execute(oldUser, newUser, client) {
        if (!oldUser || !newUser) return;
        const oldName = oldUser.globalName || oldUser.username;
        const newName = newUser.globalName || newUser.username;
        if (!oldName || !newName || oldName === newName) return;

        const base = newUser.globalName || newUser.username;

        for (const guild of client.guilds.cache.values()) {
            try {
                const member = await guild.members.fetch(newUser.id);
                await applyTargetPrefix(member, client, base);
            } catch (error) {
                continue;
            }
        }
    }
};