const { Events } = require('discord.js');

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState, client) {
        const userId = newState.member?.user?.id || oldState.member?.user?.id;
        if (!userId) return;

        const user = client.db.getUser(userId);
        if (!user) return;

        const voiceMinutes = user.voice_minutes || 0;
        if (newState.channel && !oldState.channel) {
            client.db._run('UPDATE users SET voice_minutes = voice_minutes + 1 WHERE user_id = ?', [userId]);
        } else if (!newState.channel && oldState.channel) {
            // User left voice channel - could add time-based tracking here
        }
    }
};
