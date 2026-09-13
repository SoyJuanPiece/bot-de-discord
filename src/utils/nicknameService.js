function getBaseName(member) {
    const nick = member?.nickname;
    if (nick) {
        const match = nick.match(/^\s*(?:\[[^\]]+\]|\([^)]+\))\s+(.*)$/);
        if (match && match[1]) return match[1];
    }
    const user = member?.user;
    if (user) {
        if (user.globalName) return user.globalName;
        return user.username;
    }
    return 'Usuario';
}

function buildNickname(baseName, prefix, format) {
    const tag = format === 'paren' ? `(${prefix})` : `[${prefix}]`;
    let nick = `${tag} ${baseName}`;
    if (nick.length > 32) {
        const maxBase = 32 - tag.length - 1;
        nick = `${tag} ${baseName.slice(0, maxBase)}`;
    }
    return nick;
}

async function applyTargetPrefix(member, client, forcedBase) {
    if (!member || member.partial) return;
    try {
        const guildId = member.guild.id;
        const rolePrefixes = client.db.getRolePrefixes(guildId) || [];
        const memberRoleIds = Array.from(member.roles.cache.values()).map(r => r.id);
        const matched = rolePrefixes.filter(p => memberRoleIds.includes(p.role_id));

        let prefix = null;
        let format = 'paren';

        if (matched.length > 0) {
            matched.sort((a, b) => {
                const ra = member.guild.roles.cache.get(a.role_id);
                const rb = member.guild.roles.cache.get(b.role_id);
                return (rb ? rb.position : 0) - (ra ? ra.position : 0);
            });
            prefix = matched[0].prefix_name;
        } else {
            const active = client.db.getActivePrefix(member.id);
            if (active) {
                prefix = active.prefix_name;
                format = 'brackets';
            }
        }

        const base = forcedBase || getBaseName(member);
        const target = prefix ? buildNickname(base, prefix, format) : base;

        if (member.nickname !== target) {
            await member.setNickname(target);
        }
    } catch (error) {
        console.error(`❌ Error actualizando nickname de ${member.id}:`, error);
    }
}

module.exports = { getBaseName, buildNickname, applyTargetPrefix };