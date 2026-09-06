const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class TitanDatabase {
    constructor() {
        // Asegurar que el directorio de la base de datos existe
        const dbDir = path.join(__dirname, '../../database');
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        const dbPath = process.env.DATABASE_PATH || path.join(dbDir, 'titanbot.db');
        this.db = new Database(dbPath);
        
        // Configurar PRAGMA para mejor rendimiento
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');
        
        this.initializeTables();
        console.log('✅ Base de datos inicializada correctamente');
    }

    initializeTables() {
        // Tabla de usuarios - Niveles y XP
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                username TEXT,
                xp INTEGER DEFAULT 0,
                level INTEGER DEFAULT 1,
                coins INTEGER DEFAULT 0,
                daily_claimed_at INTEGER,
                weekly_claimed_at INTEGER,
                messages_sent INTEGER DEFAULT 0,
                voice_minutes INTEGER DEFAULT 0,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER DEFAULT (strftime('%s', 'now'))
            )
        `);

        // Tabla de prefijos desbloqueados
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS user_prefixes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                prefix_name TEXT,
                unlocked_at INTEGER DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                UNIQUE(user_id, prefix_name)
            )
        `);

        // Tabla de prefijos equipados actualmente
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS active_prefixes (
                user_id TEXT PRIMARY KEY,
                prefix_name TEXT,
                equipped_at INTEGER DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            )
        `);

        // Tabla de tickets
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS tickets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticket_number INTEGER UNIQUE,
                channel_id TEXT,
                user_id TEXT,
                category TEXT,
                reason TEXT,
                status TEXT DEFAULT 'open',
                created_by TEXT,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                closed_at INTEGER,
                closed_reason TEXT,
                closed_by TEXT,
                transcript_url TEXT,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            )
        `);

        // Tabla de participantes en tickets
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS ticket_participants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticket_id INTEGER,
                user_id TEXT,
                added_at INTEGER DEFAULT (strftime('%s', 'now')),
                added_by TEXT,
                FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
            )
        `);

        // Tabla de tienda - items disponibles
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS shop_items (
                id INTEGER PRIMARY KEY,
                name TEXT,
                description TEXT,
                price INTEGER,
                item_type TEXT,
                role_id TEXT,
                prefix_name TEXT,
                crate_key TEXT,
                cosmetic_data TEXT,
                enabled INTEGER DEFAULT 1
            )
        `);

        // Tabla de compras realizadas
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS purchases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                item_id INTEGER,
                item_name TEXT,
                price_paid INTEGER,
                purchased_at INTEGER DEFAULT (strftime('%s', 'now')),
                delivered INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(user_id),
                FOREIGN KEY (item_id) REFERENCES shop_items(id)
            )
        `);

        // Tabla de advertencias (warns)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS warnings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                moderator_id TEXT,
                reason TEXT,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                expires_at INTEGER,
                active INTEGER DEFAULT 1,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            )
        `);

        // Tabla de mutes
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS mutes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                moderator_id TEXT,
                reason TEXT,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                expires_at INTEGER,
                active INTEGER DEFAULT 1,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            )
        `);

        // Tabla de configuración del servidor
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS guild_config (
                guild_id TEXT PRIMARY KEY,
                welcome_channel TEXT,
                log_channel TEXT,
                ticket_category TEXT,
                muted_role TEXT,
                staff_role TEXT,
                xp_per_message INTEGER DEFAULT 15,
                xp_per_voice_minute INTEGER DEFAULT 5,
                daily_reward INTEGER DEFAULT 100,
                auto_mod_enabled INTEGER DEFAULT 1,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            )
        `);

        // Tabla de cooldowns (para comandos spam)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS cooldowns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                command TEXT,
                last_used INTEGER,
                expires_at INTEGER
            )
        `);

        // Insertar items de tienda por defecto si no existen
        this.insertDefaultShopItems();

        // Preparar statements reutilizables
        this.prepareStatements();
    }

    prepareStatements() {
        // Statements para usuarios
        this.statements = {
            getUser: this.db.prepare('SELECT * FROM users WHERE user_id = ?'),
            createUser: this.db.prepare(`
                INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)
            `),
            updateUserXP: this.db.prepare(`
                UPDATE users SET xp = xp + ?, level = ?, updated_at = strftime('%s', 'now') WHERE user_id = ?
            `),
            updateCoins: this.db.prepare(`
                UPDATE users SET coins = coins + ?, updated_at = strftime('%s', 'now') WHERE user_id = ?
            `),
            setDailyClaim: this.db.prepare(`
                UPDATE users SET daily_claimed_at = ?, coins = coins + ? WHERE user_id = ?
            `),
            getTopUsers: this.db.prepare(`
                SELECT user_id, username, xp, level, coins 
                FROM users 
                ORDER BY xp DESC 
                LIMIT ?
            `),
            
            // Statements para prefijos
            getUserPrefixes: this.db.prepare('SELECT * FROM user_prefixes WHERE user_id = ?'),
            unlockPrefix: this.db.prepare(`
                INSERT OR IGNORE INTO user_prefixes (user_id, prefix_name) VALUES (?, ?)
            `),
            getActivePrefix: this.db.prepare('SELECT * FROM active_prefixes WHERE user_id = ?'),
            setActivePrefix: this.db.prepare(`
                INSERT OR REPLACE INTO active_prefixes (user_id, prefix_name, equipped_at) VALUES (?, ?, strftime('%s', 'now'))
            `),
            removeActivePrefix: this.db.prepare('DELETE FROM active_prefixes WHERE user_id = ?'),
            
            // Statements para tickets
            createTicket: this.db.prepare(`
                INSERT INTO tickets (ticket_number, channel_id, user_id, category, reason, created_by) 
                VALUES (?, ?, ?, ?, ?, ?)
            `),
            getTicketByChannel: this.db.prepare('SELECT * FROM tickets WHERE channel_id = ?'),
            getTicketById: this.db.prepare('SELECT * FROM tickets WHERE id = ?'),
            closeTicket: this.db.prepare(`
                UPDATE tickets SET status = 'closed', closed_at = strftime('%s', 'now'), closed_reason = ?, closed_by = ? WHERE channel_id = ?
            `),
            addTicketParticipant: this.db.prepare(`
                INSERT INTO ticket_participants (ticket_id, user_id, added_by) VALUES (?, ?, ?)
            `),
            getNextTicketNumber: this.db.prepare("SELECT COALESCE(MAX(ticket_number), 0) + 1 as next_num FROM tickets"),
            
            // Statements para tienda
            getShopItem: this.db.prepare('SELECT * FROM shop_items WHERE id = ?'),
            getAllShopItems: this.db.prepare('SELECT * FROM shop_items WHERE enabled = 1'),
            recordPurchase: this.db.prepare(`
                INSERT INTO purchases (user_id, item_id, item_name, price_paid) VALUES (?, ?, ?, ?)
            `),
            
            // Statements para moderación
            addWarning: this.db.prepare(`
                INSERT INTO warnings (user_id, moderator_id, reason, expires_at) VALUES (?, ?, ?, ?)
            `),
            getUserWarnings: this.db.prepare('SELECT * FROM warnings WHERE user_id = ? AND active = 1'),
            addMute: this.db.prepare(`
                INSERT INTO mutes (user_id, moderator_id, reason, expires_at) VALUES (?, ?, ?, ?)
            `),
            getActiveMute: this.db.prepare('SELECT * FROM mutes WHERE user_id = ? AND active = 1'),
            
            // Statements para cooldowns
            getCooldown: this.db.prepare('SELECT * FROM cooldowns WHERE user_id = ? AND command = ?'),
            setCooldown: this.db.prepare(`
                INSERT OR REPLACE INTO cooldowns (user_id, command, last_used, expires_at) VALUES (?, ?, ?, ?)
            `)
        };
    }

    insertDefaultShopItems() {
        const defaultItems = [
            { id: 1, name: 'Rol VIP', description: 'Obtén el rol VIP con beneficios exclusivos', price: 5000, item_type: 'role', role_id: 'vip_role_placeholder' },
            { id: 2, name: 'Prefijo [Leyenda]', description: 'Prefijo exclusivo para jugadores legendarios', price: 3000, item_type: 'prefix', prefix_name: 'Leyenda' },
            { id: 3, name: 'Prefijo [Elite]', description: 'Prefijo para jugadores de élite', price: 2000, item_type: 'prefix', prefix_name: 'Elite' },
            { id: 4, name: 'Llave de Crate Épico', description: 'Abre un crate épico con recompensas exclusivas', price: 1500, item_type: 'crate', crate_key: 'epic' },
            { id: 5, name: 'Llave de Crate Legendario', description: 'Abre un crate legendario con las mejores recompensas', price: 3500, item_type: 'crate', crate_key: 'legendary' },
            { id: 6, name: 'Color de Chat Rojo', description: 'Cambia el color de tu chat a rojo', price: 1000, item_type: 'cosmetic', cosmetic_data: '{"color": "red"}' },
            { id: 7, name: 'Partícula Personalizada', description: 'Efecto de partícula único alrededor de tu personaje', price: 2500, item_type: 'cosmetic', cosmetic_data: '{"particle": "heart"}' }
        ];

        for (const item of defaultItems) {
            this.db.prepare(`
                INSERT OR IGNORE INTO shop_items (id, name, description, price, item_type, role_id, prefix_name, crate_key, cosmetic_data)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(item.id, item.name, item.description, item.price, item.item_type, item.role_id || null, item.prefix_name || null, item.crate_key || null, item.cosmetic_data || null);
        }
    }

    // Métodos para usuarios
    getUser(userId) {
        let user = this.statements.getUser.get(userId);
        if (!user) {
            return null;
        }
        return user;
    }

    ensureUser(userId, username) {
        this.statements.createUser.run(userId, username);
        return this.getUser(userId);
    }

    addXP(userId, amount) {
        const user = this.getUser(userId);
        if (!user) return null;

        const newXp = user.xp + amount;
        const oldLevel = user.level;
        // Fórmula de nivel: nivel = floor(sqrt(xp / 100))
        const newLevel = Math.floor(Math.sqrt(newXp / 100));
        
        if (newLevel > oldLevel) {
            this.statements.updateUserXP.run(amount, newLevel, userId);
            return { leveledUp: true, newLevel, oldLevel };
        } else {
            this.statements.updateUserXP.run(amount, oldLevel, userId);
            return { leveledUp: false, newLevel: oldLevel };
        }
    }

    addCoins(userId, amount) {
        this.statements.updateCoins.run(amount, userId);
    }

    claimDaily(userId, amount) {
        const timestamp = Math.floor(Date.now() / 1000);
        this.statements.setDailyClaim.run(timestamp, amount, userId);
    }

    getTopUsers(limit = 10) {
        return this.statements.getTopUsers.all(limit);
    }

    // Métodos para prefijos
    getUserPrefixes(userId) {
        return this.statements.getUserPrefixes.all(userId);
    }

    unlockPrefix(userId, prefixName) {
        this.statements.unlockPrefix.run(userId, prefixName);
    }

    getActivePrefix(userId) {
        return this.statements.getActivePrefix.get(userId);
    }

    setActivePrefix(userId, prefixName) {
        this.statements.setActivePrefix.run(userId, prefixName);
    }

    removeActivePrefix(userId) {
        this.statements.removeActivePrefix.run(userId);
    }

    // Métodos para tickets
    createTicket(ticketNumber, channelId, userId, category, reason, createdBy) {
        this.statements.createTicket.run(ticketNumber, channelId, userId, category, reason, createdBy);
    }

    getTicketByChannel(channelId) {
        return this.statements.getTicketByChannel.get(channelId);
    }

    getTicketById(ticketId) {
        return this.statements.getTicketById.get(ticketId);
    }

    closeTicket(channelId, reason, closedBy) {
        this.statements.closeTicket.run(reason, closedBy, channelId);
    }

    addTicketParticipant(ticketId, userId, addedBy) {
        this.statements.addTicketParticipant.run(ticketId, userId, addedBy);
    }

    getNextTicketNumber() {
        return this.statements.getNextTicketNumber.get().next_num;
    }

    // Métodos para tienda
    getShopItem(itemId) {
        return this.statements.getShopItem.get(itemId);
    }

    getAllShopItems() {
        return this.statements.getAllShopItems.all();
    }

    recordPurchase(userId, itemId, itemName, price) {
        this.statements.recordPurchase.run(userId, itemId, itemName, price);
    }

    // Métodos para moderación
    addWarning(userId, moderatorId, reason, expiresAt = null) {
        this.statements.addWarning.run(userId, moderatorId, reason, expiresAt);
    }

    getUserWarnings(userId) {
        return this.statements.getUserWarnings.all(userId);
    }

    addMute(userId, moderatorId, reason, expiresAt) {
        this.statements.addMute.run(userId, moderatorId, reason, expiresAt);
    }

    getActiveMute(userId) {
        return this.statements.getActiveMute.get(userId);
    }

    // Métodos para cooldowns
    checkCooldown(userId, command, cooldownMs) {
        const cooldown = this.statements.getCooldown.get(userId, command);
        if (!cooldown) return { canUse: true };
        
        const now = Date.now();
        if (now < cooldown.expires_at) {
            const remaining = Math.ceil((cooldown.expires_at - now) / 1000);
            return { canUse: false, remainingSeconds: remaining };
        }
        return { canUse: true };
    }

    setCooldown(userId, command, cooldownMs) {
        const now = Date.now();
        const expiresAt = now + cooldownMs;
        this.statements.setCooldown.run(userId, command, now, expiresAt);
    }

    // Método para cerrar la conexión
    close() {
        this.db.close();
    }
}

module.exports = TitanDatabase;
