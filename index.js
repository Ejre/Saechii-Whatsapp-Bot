import makeWASocket, {
    useMultiFileAuthState,
} from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'
import pino from 'pino'
import { tmpdir } from 'os'
import 'dotenv/config'

import { cleanupOldFiles, mediaFolder } from './lib/utils.js'
import { handleMessage } from './handler.js'

// =========================
// Main Robot Logic
// =========================

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info')

    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        auth: state,
        browser: ['Ubuntu', 'Chrome', '22.04']
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update
        if (qr) qrcode.generate(qr, { small: true })
        if (connection === "open") console.log("✅ Bot terhubung ke WhatsApp")
        if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401
            console.log("❌ Koneksi terputus, reconnecting...", lastDisconnect?.error)
            if (shouldReconnect) {
                startBot()
            } else {
                console.log("🔒 Session invalid, hapus auth_info dan scan ulang QR.")
            }
        }
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            await handleMessage(sock, messages[0])
        } catch (err) {
            console.error("Error handling message:", err)
        }
    })
}

// Start auto-cleanup (every 1 hour)
setInterval(() => {
    cleanupOldFiles(mediaFolder, 60 * 60 * 1000)
    cleanupOldFiles(tmpdir(), 60 * 60 * 1000)
}, 60 * 60 * 1000)

startBot()
