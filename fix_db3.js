const fs = require('fs');
const content = fs.readFileSync('./src/database/Database.js', 'utf8');

const marker = 'addTicketParticipant(ticketId, userId, addedBy) {';

const newMethods = `    assignTicket(ticketNumber, userId) {
        this._run('UPDATE tickets SET assigned_to = ? WHERE ticket_number = ?', [userId, ticketNumber]);
    }

    getOpenTickets() {
        return this._all('SELECT * FROM tickets WHERE status = \'open\' ORDER BY created_at ASC');
    }

    updateTicketStatus(channelId, status) {
        this._run('UPDATE tickets SET status = ? WHERE channel_id = ?', [status, channelId]);
    }

    `;

if (content.includes(marker)) {
    const newContent = content.replace(marker, newMethods + marker);
    fs.writeFileSync('./src/database/Database.js', newContent);
    console.log('OK: Database.js updated with new methods');
} else {
    console.log('ERROR: marker not found');
}
