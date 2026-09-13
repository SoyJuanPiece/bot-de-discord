require('dotenv').config();

const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const Database = require('./database/Database');
const { registerSlashCommands } = require('./utils/commandRegistry');

// Crear instancia del cliente con intents necesarios
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences,
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.User,
        Partials.GuildMember
    ]
});

// Colecciones globales
client.commands = new Collection();

// Inicializar base de datos
Database.create().then(db => {
    client.db = db;
    
    // Cargar eventos
    const fs = require('fs');
    const path = require('path');

    const eventsPath = path.join(__dirname, 'events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    console.log('📦 Cargando eventos...');
    for (const file of eventFiles) {
        const event = require(`./events/${file}`);
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }
        console.log(`✅ Evento cargado: ${event.name}`);
    }

    // Cargar comandos
    const commandsPath = path.join(__dirname, 'commands');
    const commandFolders = fs.readdirSync(commandsPath);

    console.log('📦 Cargando comandos...');
    for (const folder of commandFolders) {
        const folderPath = path.join(commandsPath, folder);
        const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
            const command = require(`./commands/${folder}/${file}`);
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                console.log(`✅ Comando cargado: ${command.data.name}`);
            } else {
                console.log(`⚠️  Comando omitido (${file}): falta "data" o "execute"`);
            }
        }
    }

    // Login
    client.login(process.env.DISCORD_TOKEN);
}).catch(err => {
    console.error('❌ Error inicializando la base de datos:', err);
    process.exit(1);
});

// Manejo de cierre limpio
process.on('SIGINT', () => {
    console.log('🛑 Cerrando TitanBot...');
    if (client.db) client.db.close();
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.log('🛑 Cerrando TitanBot...');
    if (client.db) client.db.close();
    process.exit(0);
});

// Manejo de errores no capturados
process.on('unhandledRejection', error => {
    console.error('❌ Error no manejado:', error);
    process.exit(1);
});

process.on('uncaughtException', error => {
    console.error('❌ Excepción no capturada:', error);
    process.exit(1);
});
