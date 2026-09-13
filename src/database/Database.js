const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

class TitanDatabase {
    constructor(db) {
        this.db = db;
        this.dbDir = path.join(__dirname, '../../database');
        this.dbPath = process.env.DATABASE_PATH || path.join(this.dbDir, 'titanbot.db');

        this.db.run('PRAGMA foreign_keys = ON');
        this.initializeTables();
        this.insertDefaultShopItems();
        
        this._saveInterval = setInterval(() => this.save(), 30000);
        
        console.log('✅ Base de datos inicializada correctamente');
    }

    static async create() {
        const SQL = await initSqlJs();
        const dbDir = path.join(__dirname, '../../database');
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        const dbPath = process.env.DATABASE_PATH || path.join(dbDir, 'titanbot.db');
        let db;

        if (fs.existsSync(dbPath)) {
            const fileBuffer = fs.readFileSync(dbPath);
            db = new SQL.Database(fileBuffer);
        } else {
            db = new SQL.Database();
        }

        return new TitanDatabase(db);
    }

    save() {
        const data = this.db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(this.dbPath, buffer);
    }

    _run(sql, params = []) {
        this.db.run(sql, params);
        const changes = this.db.getRowsModified();
        return changes;
    }

    _get(sql, params = []) {
        const stmt = this.db.prepare(sql);
        try {
            stmt.bind(params);
            if (stmt.step()) {
                return stmt.getAsObject();
            }
            return null;
        } finally {
            stmt.free();
        }
    }

    _all(sql, params = []) {
        const stmt = this.db.prepare(sql);
        try {
            stmt.bind(params);
            const rows = [];
            while (stmt.step()) {
                rows.push(stmt.getAsObject());
            }
            return rows;
        } finally {
            stmt.free();
        }
    }

    initializeTables() {
        this.db.run(`CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY, username TEXT, xp INTEGER DEFAULT 0,
            level INTEGER DEFAULT 1, coins INTEGER DEFAULT 0,
            daily_claimed_at INTEGER, weekly_claimed_at INTEGER,
            messages_sent INTEGER DEFAULT 0, voice_minutes INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (strftime('%s','now')),
            updated_at INTEGER DEFAULT (strftime('%s','now'))
        )`);

        this.db.run(`CREATE TABLE IF NOT EXISTS user_prefixes (
            id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT,
            prefix_name TEXT, unlocked_at INTEGER DEFAULT (strftime('%s','now')),
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
            UNIQUE(user_id, prefix_name)
        )`);

        this.db.run(`CREATE TABLE IF NOT EXISTS active_prefixes (
            user_id TEXT PRIMARY KEY, prefix_name TEXT,
            equipped_at INTEGER DEFAULT (strftime('%s','now')),
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        )`);

        this.db.run(`CREATE TABLE IF NOT EXISTS tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_number INTEGER UNIQUE,
            channel_id TEXT, user_id TEXT, category TEXT, reason TEXT,
            status TEXT DEFAULT 'open', created_by TEXT,
            created_at INTEGER DEFAULT (strftime('%s','now')),
            closed_at INTEGER, closed_reason TEXT, closed_by TEXT,
            transcript_url TEXT, assigned_to TEXT, priority TEXT DEFAULT 'normal', FOREIGN KEY (user_id) REFERENCES users(user_id)
        )`);


        this.db.run(`CREATE TABLE IF NOT EXISTS ticket_participants (
            id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id INTEGER,
            user_id TEXT, added_at INTEGER DEFAULT (strftime('%s','now')),
            added_by TEXT, FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
        )`);

        this.db.run(`CREATE TABLE IF NOT EXISTS shop_items (
            id INTEGER PRIMARY KEY, name TEXT, description TEXT,
            price INTEGER, item_type TEXT, role_id TEXT, prefix_name TEXT,
            crate_key TEXT, cosmetic_data TEXT, enabled INTEGER DEFAULT 1
        )`);

        this.db.run(`CREATE TABLE IF NOT EXISTS purchases (
            id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, item_id INTEGER,
            item_name TEXT, price_paid INTEGER,
            purchased_at INTEGER DEFAULT (strftime('%s','now')),
            delivered INTEGER DEFAULT 0, FOREIGN KEY (user_id) REFERENCES users(user_id),
            FOREIGN KEY (item_id) REFERENCES shop_items(id)
        )`);

        this.db.run(`CREATE TABLE IF NOT EXISTS warnings (
            id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT,
            moderator_id TEXT, reason TEXT,
            created_at INTEGER DEFAULT (strftime('%s','now')),
            expires_at INTEGER, active INTEGER DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES users(user_id)
        )`);

        this.db.run(`CREATE TABLE IF NOT EXISTS mutes (
            id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT,
            moderator_id TEXT, reason TEXT,
            created_at INTEGER DEFAULT (strftime('%s','now')),
            expires_at INTEGER, active INTEGER DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES users(user_id)
        )`);

        this.db.run(`CREATE TABLE IF NOT EXISTS guild_config (
            guild_id TEXT PRIMARY KEY, welcome_channel TEXT,
            log_channel TEXT, ticket_category TEXT, muted_role TEXT,
            staff_role TEXT, ticket_staff_role TEXT,
            xp_per_message INTEGER DEFAULT 15,
            xp_per_voice_minute INTEGER DEFAULT 5, daily_reward INTEGER DEFAULT 100,
            auto_mod_enabled INTEGER DEFAULT 1,
            created_at INTEGER DEFAULT (strftime('%s','now'))
        )`);

        this.db.run(`CREATE TABLE IF NOT EXISTS cooldowns (
            id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT,
            command TEXT, last_used INTEGER, expires_at INTEGER
        )`);

        this.db.run(`CREATE TABLE IF NOT EXISTS role_prefixes (
            id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT,
            role_id TEXT, prefix_name TEXT,
            created_at INTEGER DEFAULT (strftime('%s','now')),
            UNIQUE(guild_id, role_id)
        )`);
    }

    insertDefaultShopItems() {
        const items = [
            [1, 'Rol VIP', 'Obtén el rol VIP con beneficios exclusivos', 5000, 'role', 'vip_role_placeholder', null, null, null],
            [2, 'Prefijo [Leyenda]', 'Prefijo exclusivo para jugadores legendarios', 3000, 'prefix', null, 'Leyenda', null, null],
            [3, 'Prefijo [Elite]', 'Prefijo para jugadores de élite', 2000, 'prefix', null, 'Elite', null, null],
            [4, 'Llave de Crate Épico', 'Abre un crate épico con recompensas exclusivas', 1500, 'crate', null, null, 'epic', null],
            [5, 'Llave de Crate Legendario', 'Abre un crate legendario con las mejores recompensas', 3500, 'crate', null, null, 'legendary', null],
            [6, 'Color de Chat Rojo', 'Cambia el color de tu chat a rojo', 1000, 'cosmetic', null, null, null, '{"color":"red"}'],
            [7, 'Partícula Personalizada', 'Efecto de partícula único alrededor de tu personaje', 2500, 'cosmetic', null, null, null, '{"particle":"heart"}']
        ];
        for (const item of items) {
            this._run(`INSERT OR IGNORE INTO shop_items (id,name,description,price,item_type,role_id,prefix_name,crate_key,cosmetic_data) VALUES (?,?,?,?,?,?,?,?,?)`, item);
        }
    }

    getUser(userId) {
        return this._get('SELECT * FROM users WHERE user_id = ?', [userId]);
    }

    ensureUser(userId, username) {
        this._run('INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)', [userId, username]);
        this._run('UPDATE users SET username = ? WHERE user_id = ?', [username, userId]);
        return this.getUser(userId);
    }

    addXP(userId, amount) {
        const user = this.getUser(userId);
        if (!user) return null;
        const newXp = user.xp + amount;
        const oldLevel = user.level;
        const newLevel = Math.floor(Math.sqrt(newXp / 100));
        if (newLevel > oldLevel) {
            this._run('UPDATE users SET xp = xp + ?, level = ?, updated_at = strftime(\'%s\',\'now\') WHERE user_id = ?', [amount, newLevel, userId]);
            return { leveledUp: true, newLevel, oldLevel };
        } else {
            this._run('UPDATE users SET xp = xp + ?, updated_at = strftime(\'%s\',\'now\') WHERE user_id = ?', [amount, userId]);
            return { leveledUp: false, newLevel: oldLevel };
        }
    }

    addCoins(userId, amount) {
        this._run('UPDATE users SET coins = coins + ?, updated_at = strftime(\'%s\',\'now\') WHERE user_id = ?', [amount, userId]);
    }

    claimDaily(userId, amount) {
        const timestamp = Math.floor(Date.now() / 1000);
        this._run('UPDATE users SET daily_claimed_at = ?, coins = coins + ? WHERE user_id = ?', [timestamp, amount, userId]);
    }

    getTopUsers(limit = 10) {
        return this._all('SELECT user_id, username, xp, level, coins FROM users ORDER BY xp DESC LIMIT ?', [limit]);
    }

    getUserPrefixes(userId) {
        return this._all('SELECT * FROM user_prefixes WHERE user_id = ?', [userId]);
    }

    unlockPrefix(userId, prefixName) {
        this._run('INSERT OR IGNORE INTO user_prefixes (user_id, prefix_name) VALUES (?, ?)', [userId, prefixName]);
    }

    getActivePrefix(userId) {
        return this._get('SELECT * FROM active_prefixes WHERE user_id = ?', [userId]);
    }

    setActivePrefix(userId, prefixName) {
        this._run('INSERT OR REPLACE INTO active_prefixes (user_id, prefix_name, equipped_at) VALUES (?, ?, strftime(\'%s\',\'now\'))', [userId, prefixName]);
    }

    removeActivePrefix(userId) {
        this._run('DELETE FROM active_prefixes WHERE user_id = ?', [userId]);
    }

    createTicket(ticketNumber, channelId, userId, category, reason, createdBy) {
        this._run('INSERT INTO tickets (ticket_number, channel_id, user_id, category, reason, created_by, assigned_to, priority) VALUES (?,?,?,?,?,?,NULL,\'normal\')', [ticketNumber, channelId, userId, category, reason, createdBy]);
    }

    getTicketByChannel(channelId) {
        return this._get('SELECT * FROM tickets WHERE channel_id = ?', [channelId]);
    }

    getTicketById(ticketId) {
        return this._get('SELECT * FROM tickets WHERE id = ?', [ticketId]);
    }

    closeTicket(channelId, reason, closedBy) {
        this._run('UPDATE tickets SET status = \'closed\', closed_at = strftime(\'%s\',\'now\'), closed_reason = ?, closed_by = ? WHERE channel_id = ?', [reason, closedBy, channelId]);
    }

        assignTicket(ticketNumber, userId) {
        this._run('UPDATE tickets SET assigned_to = ? WHERE ticket_number = ?', [userId, ticketNumber]);
    }

    getOpenTickets() {
        return this._all("SELECT * FROM tickets WHERE status = 'open' ORDER BY created_at ASC");
    }

    updateTicketStatus(channelId, status) {
        this._run('UPDATE tickets SET status = ? WHERE channel_id = ?', [status, channelId]);
    }

    addTicketParticipant(ticketId, userId, addedBy) {
        this._run('INSERT INTO ticket_participants (ticket_id, user_id, added_by) VALUES (?,?,?)', [ticketId, userId, addedBy]);
    }

    getNextTicketNumber() {
        const row = this._get('SELECT COALESCE(MAX(ticket_number), 0) + 1 as next_num FROM tickets');
        return row ? row.next_num : 1;
    }

    getShopItem(itemId) {
        return this._get('SELECT * FROM shop_items WHERE id = ?', [itemId]);
    }

    getAllShopItems() {
        return this._all('SELECT * FROM shop_items WHERE enabled = 1');
    }

    recordPurchase(userId, itemId, itemName, price) {
        this._run('INSERT INTO purchases (user_id, item_id, item_name, price_paid) VALUES (?,?,?,?)', [userId, itemId, itemName, price]);
    }

    addWarning(userId, moderatorId, reason, expiresAt = null) {
        this._run('INSERT INTO warnings (user_id, moderator_id, reason, expires_at) VALUES (?,?,?,?)', [userId, moderatorId, reason, expiresAt]);
    }

    getUserWarnings(userId) {
        return this._all('SELECT * FROM warnings WHERE user_id = ? AND active = 1', [userId]);
    }

    addMute(userId, moderatorId, reason, expiresAt) {
        this._run('INSERT INTO mutes (user_id, moderator_id, reason, expires_at) VALUES (?,?,?,?)', [userId, moderatorId, reason, expiresAt]);
    }

    getActiveMute(userId) {
        return this._get('SELECT * FROM mutes WHERE user_id = ? AND active = 1', [userId]);
    }

    checkCooldown(userId, command, cooldownMs) {
        const cooldown = this._get('SELECT * FROM cooldowns WHERE user_id = ? AND command = ?', [userId, command]);
        if (!cooldown) return { canUse: true };
        const now = Date.now();
        const expiresAt = Number(cooldown.expires_at);
        if (now < expiresAt) {
            const remaining = Math.ceil((expiresAt - now) / 1000);
            return { canUse: false, remainingSeconds: remaining };
        }
        return { canUse: true };
    }

    setCooldown(userId, command, cooldownMs) {
        const now = Date.now();
        const expiresAt = now + cooldownMs;
        this._run('INSERT OR REPLACE INTO cooldowns (user_id, command, last_used, expires_at) VALUES (?,?,?,?)', [userId, command, now, expiresAt]);
    }
    withTransaction(callback) {
        this.db.run('BEGIN IMMEDIATE');
        try {
            const result = callback(this);
            this.db.run('COMMIT');
            return result;
        } catch (e) {
            this.db.run('ROLLBACK');
            throw e;
        }
    }


    getGuildConfig(guildId) {
        let config = this._get('SELECT * FROM guild_config WHERE guild_id = ?', [guildId]);
        if (!config) {
            this._run('INSERT OR IGNORE INTO guild_config (guild_id) VALUES (?)', [guildId]);
            config = this._get('SELECT * FROM guild_config WHERE guild_id = ?', [guildId]);
        }
        return config;
    }

    setGuildConfig(guildId, field, value) {
        const allowed = ['log_channel', 'ticket_category', 'muted_role', 'staff_role', 'ticket_staff_role', 'xp_per_message', 'xp_per_voice_minute', 'daily_reward', 'auto_mod_enabled'];
        if (!allowed.includes(field)) return false;
        this.db.run(`UPDATE guild_config SET ${field} = ? WHERE guild_id = ?`, [value, guildId]);
        return true;
    }

    getLogChannel(guildId) {
        const config = this.getGuildConfig(guildId);
        return config?.log_channel || null;
    }

    getTicketCategory(guildId) {
        const config = this.getGuildConfig(guildId);
        return config?.ticket_category || null;
    }

    getRolePrefixes(guildId) {
        return this._all('SELECT * FROM role_prefixes WHERE guild_id = ?', [guildId]);
    }

    getRolePrefix(guildId, roleId) {
        return this._get('SELECT * FROM role_prefixes WHERE guild_id = ? AND role_id = ?', [guildId, roleId]);
    }

    addRolePrefix(guildId, roleId, prefixName) {
        this._run('INSERT OR REPLACE INTO role_prefixes (guild_id, role_id, prefix_name, created_at) VALUES (?,?,?,strftime(\'%s\',\'now\'))', [guildId, roleId, prefixName]);
    }

    removeRolePrefix(guildId, roleId) {
        this._run('DELETE FROM role_prefixes WHERE guild_id = ? AND role_id = ?', [guildId, roleId]);
    }

    close() {
        clearInterval(this._saveInterval);
        this.save();
        this.db.close();
    }
}

module.exports = TitanDatabase;
