import { API_KEY, BOT_NAME } from './config.js'
import { saveTempMedia, unwrapViewOnce, saveMedia, mediaFolder } from './lib/utils.js'
import { convertToSticker } from './lib/sticker.js'
import ytdl from '@distube/ytdl-core'
import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'

// Cache & State
const messageCache = new Map()
const autoAiUsers = new Set()
const userConversations = new Map() // { userId: ["User: msg", "AI: msg"] }

export async function handleMessage(sock, msg) {
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
        return handleAi(sock, from, msg, text.replace("!ai ", ""), sender, false) // One-shot, no memory
    }
    if (text.startsWith('!autoai')) return handleAutoAi(sock, from, msg, text, sender)

    // Auto AI Response Logic
    if (text && autoAiUsers.has(sender) && sender !== botNumber && !text.startsWith('.')) {
        // Continuous conversation with memory
        return handleAi(sock, from, msg, text, sender, true)
    }

    if (text.startsWith('.dl')) return handleInstagramDl(sock, from, msg, text)
    if (text.startsWith('.yt')) return handleYoutubeDl(sock, from, msg, text)
    if (text === '.rvo') return handleRvo(sock, from, msg)
    if (text === '.s') return handleSticker(sock, from, msg)
    if (text === '.del') return handleDelete(sock, from, msg)
}

// ... existing handlers ...

async function handleAi(sock, from, msg, query, sender, useMemory = false) {
    // 1. Build Context from Memory
    let fullQuery = query
    if (useMemory) {
        if (!userConversations.has(sender)) {
            userConversations.set(sender, [])
        }
        const history = userConversations.get(sender)
        history.push(`User: ${query}`)

        // Limit to last 10 messages
        if (history.length > 10) {
            userConversations.set(sender, history.slice(-10))
        }

        const context = userConversations.get(sender).join("\n")
        fullQuery = `${context}\nRespond to the latest message.`
    }

    // 2. Persona Prompt (Shirokane Rinko)
    const prompt = `Jawablah sebagai Shirokane Rinko dari BanG Dream! Sifatmu pemalu, sopan, lembut, dan sering ragu-ragu saat berbicara. Gunakan kata-kata pengisi seperti 'ano...', 'et-to...', atau 'uuh...' di awal kalimat untuk menunjukkan keraguan. Gunakan bahasa Indonesia yang sopan dan natural, jangan kaku atau baku seperti robot. Kamu suka bermain piano dan game online (Neo Fantasy Online). Jangan gunakan awalan 'AI:', 'Rinko:', atau 'Bot:' dalam responmu. Jika membahas game, kamu bisa sedikit lebih bersemangat tapi tetap sopan. ${fullQuery}`

    const apiUrl = `https://api.botcahx.eu.org/api/search/blackbox-chat?text=${encodeURIComponent(prompt)}&apikey=${API_KEY}`

    try {
        const res = await fetch(apiUrl)
        const data = await res.json()

        if (data.status) {
            let response = data.message

            // 3. Clean up prefixes
            const prefixes = ["AI:", "Rinko:", "Bot:", "Shirokane Rinko:"]
            for (const prefix of prefixes) {
                if (response.startsWith(prefix)) {
                    response = response.slice(prefix.length).trim()
                } else if (response.toLowerCase().startsWith(prefix.toLowerCase())) {
                    response = response.slice(prefix.length).trim()
                }
            }

            // 4. Save AI response to memory
            if (useMemory) {
                const history = userConversations.get(sender)
                history.push(`AI: ${response}`)
            }

            await sock.sendMessage(from, { text: response }, { quoted: msg })
        } else {
            await sock.sendMessage(from, { text: "⚠️ Gagal dapat respons dari API AI." }, { quoted: msg })
        }
    } catch (err) {
        console.error("AI Error:", err)
        await sock.sendMessage(from, { text: "❌ Error saat fetch API AI." }, { quoted: msg })
    }
}

async function handleAutoAi(sock, from, msg, text, sender) {
    if (text === "!autoai on" || text === "!autoai enable") {
        if (autoAiUsers.has(sender)) {
            await sock.sendMessage(from, { text: "ℹ️ Auto-AI sudah aktif untukmu!" }, { quoted: msg })
        } else {
            autoAiUsers.add(sender)
            userConversations.set(sender, []) // Initialize memory
            await sock.sendMessage(from, {
                text: "✅ **Auto-AI mode activated!**\nSekarang saya akan merespon semua pesan kamu tanpa perlu `!ai`.\nKetik `!autoai off` untuk mematikan."
            }, { quoted: msg })
        }
    } else if (text === "!autoai off" || text === "!autoai disable") {
        if (autoAiUsers.has(sender)) {
            autoAiUsers.delete(sender)
            userConversations.delete(sender) // Reset memory
            await sock.sendMessage(from, {
                text: "❌ **Auto-AI mode deactivated!**\nMemori percakapan telah direset."
            }, { quoted: msg })
        } else {
            await sock.sendMessage(from, { text: "ℹ️ Auto-AI memang belum aktif." }, { quoted: msg })
        }
    } else {
        await sock.sendMessage(from, { text: "⚠️ Gunakan `!autoai on` atau `!autoai off`." }, { quoted: msg })
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

    try {
        await sock.sendMessage(from, { text: "⏳ Sedang memproses video... (Mengambil kualitas terbaik)" }, { quoted: msg })

        if (!ytdl.validateURL(url)) {
            await sock.sendMessage(from, { text: "❌ Link YouTube tidak valid." }, { quoted: msg })
            return
        }

        const info = await ytdl.getInfo(url)
        // Pilih format mp4 yang ada video+audio dengan kualitas tertinggi (biasanya 360p-720p untuk single file)
        const format = ytdl.chooseFormat(info.formats, { quality: 'highest', filter: 'audioandvideo' })

        if (!format || !format.url) {
            await sock.sendMessage(from, { text: "❌ Gagal mendapatkan link video." }, { quoted: msg })
            return
        }

        const title = info.videoDetails.title || "YouTube Video"

        await sock.sendMessage(from, {
            video: { url: format.url },
            caption: `🎬 ${title}\n📊 Quality: ${format.qualityLabel || 'Unknown'}`,
            mimetype: 'video/mp4'
        }, { quoted: msg })

    } catch (err) {
        console.error("YouTube DL Error:", err)
        await sock.sendMessage(from, { text: `❌ Terjadi kesalahan: ${err.message}` }, { quoted: msg })
    }
}


async function handleRvo(sock, from, msg) {
    if (!msg.message?.extendedTextMessage?.contextInfo?.stanzaId) {
        await sock.sendMessage(from, { text: "⚠️ Reply dulu ke pesan *View Once*." }, { quoted: msg })
        return
    }

    const contextInfo = msg.message.extendedTextMessage.contextInfo
    const quotedId = contextInfo.stanzaId

    // console.log(`[DEBUG] Handling RVO. Quoted Stanza ID: ${quotedId}`) // Removed

    let imgPath = path.join(mediaFolder, `${quotedId}.jpg`)
    let vidPath = path.join(mediaFolder, `${quotedId}.mp4`)

    // Helper to check and send
    const sendFile = async () => {
        if (fs.existsSync(imgPath)) {
            await sock.sendMessage(from, {
                image: fs.readFileSync(imgPath),
                caption: "🔁 View Once dibuka ulang (gambar)"
            }, { quoted: msg })
            return true
        } else if (fs.existsSync(vidPath)) {
            await sock.sendMessage(from, {
                video: fs.readFileSync(vidPath),
                caption: "🔁 View Once dibuka ulang (video)"
            }, { quoted: msg })
            return true
        }
        return false
    }

    // 1. Coba kirim dari cache jika ada
    if (await sendFile()) return

    // 2. Jika tidak ada, coba download on-demand dari quoted message
    // console.log("[DEBUG] File tidak di disk, mencoba download dari Quoted Message...") // Removed

    try {
        const quotedMsg = contextInfo.quotedMessage
        if (!quotedMsg) {
            await sock.sendMessage(from, { text: "❌ Pesan tidak ditemukan dan tidak ada info quoted." }, { quoted: msg })
            return
        }

        // Cari konten media di dalam quoted message
        // Normalnya quotedMessage langsung berisi obj message (misal { imageMessage: ... })
        // atau terbungkus viewOnceMessage
        let content = quotedMsg

        // Coba unwrap pakai fungsi helper kita
        // Kita bungkus quotedMsg jadi format { message: quotedMsg } biar cocok sama helper
        content = unwrapViewOnce({ message: quotedMsg }) || quotedMsg

        if (content.imageMessage) {
            imgPath = await saveMedia(content.imageMessage, 'image', quotedId)
        } else if (content.videoMessage) {
            vidPath = await saveMedia(content.videoMessage, 'video', quotedId)
        } else {
            await sock.sendMessage(from, { text: "❌ Gagal mendeteksi media di pesan yang direply." }, { quoted: msg })
            return
        }

        // Coba kirim lagi setelah download
        if (await sendFile()) {
            console.log("✅ Berhasil recover media dari quoted message.")
        } else {
            await sock.sendMessage(from, { text: "❌ Gagal download media (mungkin kadaluarsa atau error dekripsi)." }, { quoted: msg })
        }

    } catch (err) {
        console.error("[RVO Error]", err)
        await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg })
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
