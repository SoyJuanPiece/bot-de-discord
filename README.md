# 🤖 TitanBot - Bot de Administración para Discord y Minecraft

[![Discord.js](https://img.shields.io/badge/discord.js-v14-blue.svg)](https://discord.js.org)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-green.svg)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)

Bot completo de administración, moderación y automatización para servidores de Discord y Minecraft.

## 📋 Características Principales

### 🏆 Sistema de Niveles
- Ganancia automática de XP por mensajes y tiempo en voz
- Tablas de clasificación semanales/mensuales
- Notificaciones de subida de nivel
- Recompensas automáticas por alcanzar niveles

### 💰 Economía Integrada
- Moneda interna acumulable
- Recompensa diaria con bono por nivel
- Tienda con roles, prefijos, llaves de crates y cosméticos
- Sistema de compras automático

### 🎫 Sistema de Tickets
- 4 categorías: Soporte General, Reportes, Tienda, Apelaciones
- Canales privados exclusivos
- Historial y transcripciones
- Gestión multi-usuario

### 🏷️ Sistema de Prefijos
- Prefijos desbloqueables por nivel
- Compra de prefijos exclusivos en tienda
- Sincronización de apodos en Discord
- Integración con Minecraft (requiere plugin adicional)

### 🛡️ Moderación Completa
- `/warn` - Advertencias con registro
- `/mute` - Silenciamiento temporal
- `/kick` - Expulsión del servidor
- `/ban` - Baneo permanente
- Auto-moderación básica (spam, menciones, mayúsculas)
- Registro completo en canal de logs

## 🚀 Instalación

### Requisitos Previos
- Node.js v18 o superior
- SQLite (incluido en dependencias)
- Token de bot de Discord
- Permisos de administrador en el servidor

### Pasos de Instalación

1. **Clonar el repositorio**
```bash
git clone <repository-url>
cd titanbot
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
cp .env.example .env
```

Edita `.env` con tus credenciales:
```env
DISCORD_TOKEN=tu_token_aqui
GUILD_ID=id_de_tu_servidor
LOG_CHANNEL_ID=id_canal_logs
TICKET_CATEGORY_ID=id_categoria_tickets
```

4. **Iniciar el bot**
```bash
# Producción
npm start

# Desarrollo (con auto-reload)
npm run dev
```

## 📁 Estructura del Proyecto

```
titanbot/
├── src/
│   ├── index.js              # Punto de entrada principal
│   ├── commands/             # Comandos organizados por categoría
│   │   ├── levels/           # Comandos de niveles
│   │   │   ├── rank.js
│   │   │   └── top.js
│   │   ├── economy/          # Comandos de economía
│   │   │   ├── balance.js
│   │   │   ├── daily.js
│   │   │   ├── shop.js
│   │   │   └── buy.js
│   │   ├── tickets/          # Comandos de tickets
│   │   │   └── ticket.js
│   │   ├── prefixes/         # Comandos de prefijos
│   │   │   └── prefijos.js
│   │   ├── moderation/       # Comandos de moderación
│   │   │   ├── warn.js
│   │   │   ├── mute.js
│   │   │   ├── kick.js
│   │   │   └── ban.js
│   │   └── general/          # Comandos generales
│   │       └── help.js
│   ├── events/               # Manejadores de eventos
│   │   ├── interactionCreate.js
│   │   └── messageCreate.js
│   ├── database/             # Base de datos y modelos
│   │   └── Database.js
│   ├── utils/                # Utilidades y helpers
│   │   ├── commandRegistry.js
│   │   ├── buttonHandler.js
│   │   ├── selectHandler.js
│   │   └── modalHandler.js
│   └── config/               # Configuraciones
├── database/                  # Archivos de base de datos (auto-generado)
├── .env                       # Variables de entorno (no commitear)
├── .env.example              # Ejemplo de variables
├── package.json
└── README.md
```

## 🎮 Comandos Disponibles

### Niveles
| Comando | Descripción |
|---------|-------------|
| `/rank [@usuario]` | Ver tarjeta de nivel y progreso |
| `/top [tipo] [cantidad]` | Ranking de usuarios activos |

### Economía
| Comando | Descripción |
|---------|-------------|
| `/saldo [@usuario]` | Ver monedas actuales |
| `/diario` | Reclamar recompensa diaria |
| `/tienda` | Ver catálogo de items |
| `/comprar [item_id]` | Comprar un item |

### Tickets
| Comando | Descripción |
|---------|-------------|
| `/ticket crear [categoría] [motivo]` | Abrir nuevo ticket |
| `/ticket cerrar [razón]` | Cerrar ticket actual |
| `/ticket agregar [@usuario]` | Agregar usuario al ticket |

### Prefijos
| Comando | Descripción |
|---------|-------------|
| `/prefijos lista` | Ver prefijos disponibles |
| `/prefijos equipar [nombre]` | Equipar un prefijo |
| `/prefijos remover` | Quitar prefijo actual |

### Moderación (Staff Only)
| Comando | Descripción |
|---------|-------------|
| `/warn [@usuario] [motivo]` | Advertir usuario |
| `/mute [@usuario] [tiempo] [motivo]` | Silenciar temporalmente |
| `/kick [@usuario] [motivo]` | Expulsar del servidor |
| `/ban [@usuario] [motivo]` | Banear permanentemente |

### General
| Comando | Descripción |
|---------|-------------|
| `/help` | Mostrar ayuda completa |

## ⚙️ Configuración Avanzada

### Permisos Requeridos del Bot
- Administrar canales
- Administrar mensajes
- Administrar roles
- Administrar apodos
- Leer historial de mensajes
- Enviar mensajes
- Insertar embeds
- Usar comandos de aplicación

### Configuración de Minecraft (Opcional)
Para sincronización con servidor de Minecraft, se requiere:
1. Plugin RCON en el servidor de Minecraft
2. Configurar `RCON_PASSWORD` en `.env` (NO RECOMENDADO para producción)
3. Usar API externa segura para comunicación

## 🔒 Seguridad

- Nunca compartas tu token de Discord
- No expongas contraseñas RCON en repositorios públicos
- Usa variables de entorno en producción
- El bot no almacena información confidencial

## 📄 Licencia

MIT License - ver archivo [LICENSE](LICENSE) para más detalles.

## 🤝 Soporte

Para soporte técnico, reportes de bugs o sugerencias:
- Abre un issue en GitHub
- Únete a nuestro servidor de Discord
- Abre un ticket usando `/ticket` en el servidor oficial

---

**Desarrollado con ❤️ para comunidades de Discord y Minecraft**
