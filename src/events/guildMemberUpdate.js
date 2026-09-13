const { Events } = require('discord.js');
const { applyTargetPrefix } = require('../utils/nicknameService');

module.exports = {
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember, client) {
        if (!newMember || newMember.partial) return;
        try {
            const rolePrefixes = client.db.getRolePrefixes(newMember.guild.id) || [];
            if (rolePrefixes.length === 0) return;

            const oldRoles = new Set(Array.from(oldMember?.roles?.cache?.values?.() || []).map(r => r.id));
            const newRoles = new Set(Array.from(newMember.roles.cache.values()).map(r => r.id));
            const configured = new Set(rolePrefixes.map(p => p.role_id));

            let changed = false;
            for (const roleId of oldRoles) {
                if (configured.has(roleId) && !newRoles.has(roleId)) changed = true;
            }
            for (const roleId of newRoles) {
                if (configured.has(roleId) && !oldRoles.has(roleId)) changed = true;
            }
            if (!changed) return;

            await applyTargetPrefix(newMember, client);
        } catch (error) {
            console.error('❌ Error en guildMemberUpdate:', error);
        }
    }
};