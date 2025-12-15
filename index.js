import makeWASocket, {
    useMultiFileAuthState,
    downloadContentFromMessage,
    DisconnectReason
} from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'
import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import ffmpeg from 'fluent-ffmpeg'
import { tmpdir } from 'os'
import { randomBytes } from 'crypto'

// =========================
// Configuration
// =========================
const API_KEY = "IQeFNK4E" // Botcahx API Key (Updated from user example)
const BOT_NAME = "Saechii Bot"

// Cache & State
const messageCache = new Map()
const autoAiUsers = new Set()

// Folder Media
const mediaFolder = path.join(process.cwd(), 'rvo_media')
if (!fs.existsSync(mediaFolder)) fs.mkdirSync(mediaFolder)

// =========================
// Helper Functions
// =========================

/**
 * Simpan media dari pesan WhatsApp ke file sementara
 */
async function saveTempMedia(content, type) {
    const stream = await downloadContentFromMessage(content, type)
    let buffer = Buffer.from([])
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])

    const ext = type === 'image' ? 'jpg' : 'mp4'
    const filename = path.join(tmpdir(), randomBytes(6).toString('hex') + '.' + ext)
    fs.writeFileSync(filename, buffer)
    return filename
}

/**
 * Convert gambar/video ke sticker webp
 */
async function convertToSticker(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .outputOptions([
                '-y',
                '-vcodec', 'libwebp',
                '-vf', "scale=512:512:force_original_aspect_ratio=decrease,fps=15,pad=512:512:(ow-iw)/2:(oh-ih)/2:white",
                '-loop', '0',
                '-ss', '0',
                '-t', '6',
                '-preset', 'default',
                '-an',
                '-vsync', '0'
            ])
            .save(outputPath)
            .on('end', () => resolve(outputPath))
            .on('error', reject)
    })
}

/**
 * Mendapatkan konten pesan dari View Once
 */
function unwrapViewOnce(msg) {
    let content = msg.message
    if (content?.viewOnceMessageV2) content = content.viewOnceMessageV2.message
    if (content?.viewOnceMessageV2Extension) content = content.viewOnceMessageV2Extension.message
    return content
}

/**
 * Simpan media View Once secara otomatis
 */
async function saveMedia(content, type, keyId) {
    try {
        const stream = await downloadContentFromMessage(content, type)
        let buffer = Buffer.from([])
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])

        const ext = type === 'image' ? 'jpg' : 'mp4'
        const filePath = path.join(mediaFolder, `${keyId}.${ext}`)
        fs.writeFileSync(filePath, buffer)
        console.log(`✅ Media View Once tersimpan: ${filePath}`)
        return filePath
    } catch (err) {
        console.error("❌ Gagal simpan media:", err)
    }
}

// =========================
// Command Handlers
// =========================

async function handleMenu(sock, from, msg) {
    const menuText = `
*${BOT_NAME} Menu*

1. .menu → Tampilkan menu ini
2. .ping → Cek bot aktif
3. .tagall / .p / .h <pesan> → Mention semua anggota
4. !ai <teks> → Tanya AI
5. !autoai enable/disable → Mode ngobrol AI
6. .rvo → Buka pesan View Once (reply)
7. .del → Hapus pesan bot (reply)
8. .s → Buat stiker (reply gambar/video)
9. .dl <link> → Instagram Downloader
10. .yt <link> → YouTube Video Downloader
    `
    await sock.sendMessage(from, { text: menuText }, { quoted: msg })
}

async function handlePing(sock, from, msg) {
    await sock.sendMessage(from, { text: "🏓 Pong! Bot aktif." }, { quoted: msg })
}

async function handleTagAll(sock, from, msg, text) {
    // 1. Cek apakah ini Grup?
    if (!from.endsWith('@g.us')) {
        await sock.sendMessage(from, { text: "⚠️ Fitur ini hanya bisa digunakan di dalam grup!" }, { quoted: msg })
        return
    }

    try {
        const metadata = await sock.groupMetadata(from)
        const participants = metadata.participants.map(p => p.id)

        // Cek apakah command .h (hidden tag dengan pesan custom) atau tagall biasa
        let pesan = ""
        if (text.startsWith('.h')) {
            pesan = text.slice(2).trim()
        } else if (text === '.p' || text === '.tagall') {
            pesan = ""
        }

        // Jika .p, tampilkan list di text, jika .h hanya text biasa tapi mention all
        if (text === '.p') {
            await sock.sendMessage(from, {
                text: participants.map(u => `@${u.split('@')[0]}`).join('\n'),
                mentions: participants
            }, { quoted: msg })
        } else {
            await sock.sendMessage(from, {
                text: pesan || "Tag All", // Default text jika kosong
                mentions: participants
            }, { quoted: msg })
        }
    } catch (err) {
        console.error("TagAll Error:", err)
        await sock.sendMessage(from, { text: "❌ Gagal mengambil info grup (pastikan bot ada di grup)." }, { quoted: msg })
    }
}

async function handleAi(sock, from, msg, query) {
    const fullQuery = "Jawablah seperti karakter anime perempuan dengan sifat tsundere, gunakan bahasa indonesia yang malu-malu, agak ragu, dan tambahkan emotikon seperti (>///<) atau ///. " + query
    const apiUrl = `https://api.botcahx.eu.org/api/search/blackbox-chat?text=${encodeURIComponent(fullQuery)}&apikey=${API_KEY}`

    try {
        const res = await fetch(apiUrl)
        const data = await res.json()
        if (data.status) {
            await sock.sendMessage(from, { text: data.message }, { quoted: msg })
        } else {
            await sock.sendMessage(from, { text: "⚠️ Gagal dapat respons dari API AI." }, { quoted: msg })
        }
    } catch (err) {
        console.error("AI Error:", err)
        await sock.sendMessage(from, { text: "❌ Error saat fetch API AI." }, { quoted: msg })
    }
}

async function handleAutoAi(sock, from, msg, text, sender) {
    const user = sender
    if (text === "!autoai enable") {
        autoAiUsers.add(user)
        await sock.sendMessage(from, { text: "✅ AutoAI diaktifkan untukmu." }, { quoted: msg })
    } else if (text === "!autoai disable") {
        autoAiUsers.delete(user)
        await sock.sendMessage(from, { text: "❌ AutoAI dimatikan untukmu." }, { quoted: msg })
    }
}

async function handleInstagramDl(sock, from, msg, text) {
    let url
    // Cek reply atau argument
    if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        const quoted = msg.message.extendedTextMessage.contextInfo.quotedMessage
        url = quoted.conversation || quoted.extendedTextMessage?.text
    } else {
        url = text.split(' ')[1]
    }

    if (!url) {
        await sock.sendMessage(from, { text: "⚠️ Harap sertakan link atau reply pesan yang berisi link.\nContoh: .dl https://instagram.com/reel/xxx" }, { quoted: msg })
        return
    }

    const apiUrl = `https://api.botcahx.eu.org/api/dowloader/igdowloader?url=${encodeURIComponent(url)}&apikey=${API_KEY}`

    try {
        const res = await fetch(apiUrl)
        const rawText = await res.text()
        let data
        try {
            data = JSON.parse(rawText)
        } catch {
            console.error("❌ API IG balas bukan JSON:", rawText?.slice(0, 200))
            await sock.sendMessage(from, { text: "❌ API Error (response not JSON)." }, { quoted: msg })
            return
        }

        if (!data.status || !data.result) {
            await sock.sendMessage(from, { text: "❌ Gagal download media Instagram." }, { quoted: msg })
            return
        }

        const medias = Array.isArray(data.result) ? data.result : [data.result]
        for (let media of medias) {
            if (media.type === "image") {
                await sock.sendMessage(from, { image: { url: media.url } }, { quoted: msg })
            } else {
                await sock.sendMessage(from, { video: { url: media.url } }, { quoted: msg })
            }
        }
    } catch (err) {
        console.error("IG DL Error:", err)
        await sock.sendMessage(from, { text: "❌ Error saat mencoba download Instagram." }, { quoted: msg })
    }
}

async function handleYoutubeDl(sock, from, msg, text) {
    let url
    // Cek reply atau argument
    if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        const quoted = msg.message.extendedTextMessage.contextInfo.quotedMessage
        url = quoted.conversation || quoted.extendedTextMessage?.text
    } else {
        url = text.split(' ')[1]
    }

    if (!url) {
        await sock.sendMessage(from, { text: "⚠️ Harap sertakan link YouTube.\nContoh: .yt https://youtu.be/xxx" }, { quoted: msg })
        return
    }

    // Menggunakan endpoint yang diberikan user (dowloader/yt)
    const apiUrl = `https://api.botcahx.eu.org/api/dowloader/yt?url=${encodeURIComponent(url)}&apikey=${API_KEY}`

    try {
        await sock.sendMessage(from, { text: "⏳ Sedang memproses video... (bisa memakan waktu jika server sibuk)" }, { quoted: msg })

        // Timeout 60 detik
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        try {
            const res = await fetch(apiUrl, { signal: controller.signal })
            clearTimeout(timeoutId);

            if (!res.ok) {
                throw new Error(`API Error ${res.status}: ${res.statusText}`);
            }

            const rawText = await res.text()
            let data

            try {
                data = JSON.parse(rawText)
            } catch (e) {
                console.error("❌ API YouTube balas bukan JSON:", rawText?.slice(0, 200))
                await sock.sendMessage(from, { text: `❌ Gagal parse respon API (bukan JSON).\nServer mungkin sedang maintenance.` }, { quoted: msg })
                return
            }

            if (!data.status || !data.result) {
                const errMsg = data.message || "Gagal mengambil data video YouTube."
                await sock.sendMessage(from, { text: `❌ ${errMsg}` }, { quoted: msg })
                return
            }

            // Struktur result API Botcahx ytmp4
            const videoUrl = data.result.url || data.result.video || data.result.mp4
            const title = data.result.title || "YouTube Video"

            if (!videoUrl) {
                await sock.sendMessage(from, { text: "❌ Link video tidak ditemukan dalam respon API." }, { quoted: msg })
                return
            }

            await sock.sendMessage(from, {
                video: { url: videoUrl },
                caption: `🎬 ${title}`
            }, { quoted: msg })

        } catch (fetchErr) {
            clearTimeout(timeoutId);
            throw fetchErr;
        }

    } catch (err) {
        console.error("YouTube DL Error:", err)
        if (err.name === 'AbortError') {
            await sock.sendMessage(from, { text: "❌ Waktu habis (Timeout). Server Botcahx tidak merespon dalam 60 detik." }, { quoted: msg })
        } else {
            await sock.sendMessage(from, { text: `❌ Terjadi kesalahan: ${err.message}` }, { quoted: msg })
        }
    }
}


async function handleRvo(sock, from, msg) {
    if (!msg.message?.extendedTextMessage?.contextInfo?.stanzaId) {
        await sock.sendMessage(from, { text: "⚠️ Reply dulu ke pesan *View Once*." }, { quoted: msg })
        return
    }

    const quotedId = msg.message.extendedTextMessage.contextInfo.stanzaId
    const imgPath = path.join(mediaFolder, `${quotedId}.jpg`)
    const vidPath = path.join(mediaFolder, `${quotedId}.mp4`)

    if (fs.existsSync(imgPath)) {
        await sock.sendMessage(from, {
            image: fs.readFileSync(imgPath),
            caption: "🔁 View Once dibuka ulang (gambar)"
        }, { quoted: msg })
    } else if (fs.existsSync(vidPath)) {
        await sock.sendMessage(from, {
            video: fs.readFileSync(vidPath),
            caption: "🔁 View Once dibuka ulang (video)"
        }, { quoted: msg })
    } else {
        await sock.sendMessage(from, { text: "❌ Pesan tidak ditemukan di cache/disk." }, { quoted: msg })
    }
}

async function handleSticker(sock, from, msg) {
    if (!msg.message?.extendedTextMessage?.contextInfo?.stanzaId) {
        await sock.sendMessage(from, { text: "⚠️ Reply dulu ke gambar/video 1-6 detik." }, { quoted: msg })
        return
    }

    const quotedId = msg.message.extendedTextMessage.contextInfo.stanzaId
    const quotedMsg = messageCache.get(quotedId)

    if (!quotedMsg) {
        await sock.sendMessage(from, { text: "❌ Pesan tidak ditemukan di cache (bot mungkin baru restart)." }, { quoted: msg })
        return
    }

    const content = unwrapViewOnce(quotedMsg) || quotedMsg.message

    try {
        let inputPath
        if (content.imageMessage) {
            inputPath = await saveTempMedia(content.imageMessage, 'image')
        } else if (content.videoMessage) {
            inputPath = await saveTempMedia(content.videoMessage, 'video')
        } else {
            await sock.sendMessage(from, { text: "⚠️ Hanya valid untuk gambar atau video." }, { quoted: msg })
            return
        }

        const outputPath = inputPath.replace(/\.\w+$/, ".webp")
        await convertToSticker(inputPath, outputPath)

        await sock.sendMessage(from, { sticker: fs.readFileSync(outputPath) }, { quoted: msg })

        fs.unlinkSync(inputPath)
        fs.unlinkSync(outputPath)
    } catch (err) {
        console.error("Sticker error:", err)
        await sock.sendMessage(from, { text: "❌ Gagal membuat sticker." }, { quoted: msg })
    }
}

async function handleDelete(sock, from, msg) {
    if (!msg.message?.extendedTextMessage?.contextInfo?.stanzaId) {
        await sock.sendMessage(from, { text: "⚠️ Reply dulu pesan yang mau dihapus." }, { quoted: msg })
        return
    }
    const quoted = msg.message.extendedTextMessage.contextInfo
    try {
        await sock.sendMessage(from, {
            delete: {
                remoteJid: from,
                fromMe: false,
                id: quoted.stanzaId,
                participant: quoted.participant
            }
        })
    } catch (err) {
        console.error("Delete Error:", err)
        await sock.sendMessage(from, { text: "❌ Gagal menghapus pesan." }, { quoted: msg })
    }
}


// =========================
// Main Robot Logic
// =========================

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info')

    const sock = makeWASocket({
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
        const msg = messages[0]
        if (!msg.message) return

        // Simpan pesan ke cache untuk fitur sticker/reply
        messageCache.set(msg.key.id, msg)

        const content = unwrapViewOnce(msg) || msg.message
        const keyId = msg.key.id
        const from = msg.key.remoteJid
        const sender = msg.key.participant || msg.key.remoteJid
        const botNumber = sock.user.id.split(":")[0] + "@s.whatsapp.net"

        // Handle text message
        let text = msg.message.conversation || msg.message.extendedTextMessage?.text || ""
        if (msg.message.imageMessage?.caption) text = msg.message.imageMessage.caption
        if (msg.message.videoMessage?.caption) text = msg.message.videoMessage.caption

        // 1. Auto-save View Once
        if (content.imageMessage) await saveMedia(content.imageMessage, 'image', keyId)
        if (content.videoMessage) await saveMedia(content.videoMessage, 'video', keyId)

        // 2. Command Dispatcher
        if (text === '.menu') return handleMenu(sock, from, msg)
        if (text === '.ping') return handlePing(sock, from, msg)
        if (text.startsWith('.p') || text.startsWith('.tagall') || text.startsWith('.h')) return handleTagAll(sock, from, msg, text)
        if (text.startsWith('!ai ')) {
            if (sender === botNumber) return
            return handleAi(sock, from, msg, text.replace("!ai ", ""))
        }
        if (text.startsWith('!autoai')) return handleAutoAi(sock, from, msg, text, sender)

        // Auto AI Response Logic
        if (autoAiUsers.has(sender) && sender !== botNumber && !text.startsWith('.')) {
            // Jika bukan command (awalan .), anggap chat biasa ke AI
            return handleAi(sock, from, msg, text)
        }

        if (text.startsWith('.dl')) return handleInstagramDl(sock, from, msg, text)
        if (text.startsWith('.yt')) return handleYoutubeDl(sock, from, msg, text)
        if (text === '.rvo') return handleRvo(sock, from, msg)
        if (text === '.s') return handleSticker(sock, from, msg)
        if (text === '.del') return handleDelete(sock, from, msg)
    })
}

startBot()
