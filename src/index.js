require('dotenv').config();

const { Client, GatewayIntentBits, Collection, ActivityType, Partials } = require('discord.js');
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
        GatewayIntentBits.GuildModeration,
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
client.cooldowns = new Collection();

// Inicializar base de datos
const db = new Database();
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

// Evento ready
client.once('ready', async () => {
    console.log('╔════════════════════════════════════════╗');
    console.log('║         🤖 TITANBOT ONLINE 🤖          ║');
    console.log('╚════════════════════════════════════════╝');
    console.log(`👤 Conectado como: ${client.user.tag}`);
    console.log(`🏠 Servidores: ${client.guilds.cache.size}`);
    console.log(`👥 Usuarios: ${client.users.cache.size}`);
    
    // Configurar actividad
    client.user.setPresence({
        activities: [{ 
            name: '/help | TitanBot v1.0', 
            type: ActivityType.Watching 
        }],
        status: 'online'
    });
    
    // Registrar comandos slash
    await registerSlashCommands(client);
    
    console.log('✨ Bot listo para servir a la comunidad');
});

// Manejo de errores no capturados
process.on('unhandledRejection', error => {
    console.error('❌ Error no manejado:', error);
});

process.on('uncaughtException', error => {
    console.error('❌ Excepción no capturada:', error);
});

// Login
client.login(process.env.DISCORD_TOKEN);
