import { downloadContentFromMessage } from '@whiskeysockets/baileys'
import fs from 'fs'
import path from 'path'
import { tmpdir } from 'os'
import { randomBytes } from 'crypto'

export const mediaFolder = path.join(process.cwd(), 'rvo_media')
if (!fs.existsSync(mediaFolder)) fs.mkdirSync(mediaFolder)

/**
 * Simpan media dari pesan WhatsApp ke file sementara
 */
export async function saveTempMedia(content, type) {
    const stream = await downloadContentFromMessage(content, type)
    let buffer = Buffer.from([])
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])

    const ext = type === 'image' ? 'jpg' : 'mp4'
    const filename = path.join(tmpdir(), randomBytes(6).toString('hex') + '.' + ext)
    fs.writeFileSync(filename, buffer)
    return filename
}

/**
 * Mendapatkan konten pesan dari View Once
 */
export function unwrapViewOnce(msg) {
    if (!msg) return null;
    let content = msg.message || msg;

    // Handle Ephemeral (Disappearing Messages)
    if (content?.ephemeralMessage) {
        content = content.ephemeralMessage.message
    }

    // Handle ViewOnce V1
    if (content?.viewOnceMessage) {
        content = content.viewOnceMessage.message
    }

    // Handle ViewOnce V2
    if (content?.viewOnceMessageV2) {
        content = content.viewOnceMessageV2.message
    }

    // Handle ViewOnce V2 Extension
    if (content?.viewOnceMessageV2Extension) {
        content = content.viewOnceMessageV2Extension.message
    }

    return content
}

/**
 * Simpan media View Once secara otomatis
 */
export async function saveMedia(content, type, keyId) {
    try {
        const stream = await downloadContentFromMessage(content, type)
        let buffer = Buffer.from([])
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])

        const ext = type === 'image' ? 'jpg' : 'mp4'
        const filePath = path.join(mediaFolder, `${keyId}.${ext}`)
        fs.writeFileSync(filePath, buffer)
        return filePath
    } catch (err) {
        // console.error("❌ Gagal simpan media:", err)
    }
}

/**
 * Cleanup Function
 */
export function cleanupOldFiles(dir, maxAgeMs) {
    fs.readdir(dir, (err, files) => {
        if (err) return console.error(`[Cleanup] Gagal baca folder ${dir}:`, err)

        files.forEach(file => {
            const filePath = path.join(dir, file)
            fs.stat(filePath, (err, stats) => {
                if (err) return
                const now = Date.now()
                if (now - stats.mtimeMs > maxAgeMs) {
                    fs.unlink(filePath, (err) => {
                        if (err) console.error(`[Cleanup] Gagal hapus ${file}:`, err)
                        else console.log(`[Cleanup] Menghapus file lama: ${file}`)
                    })
                }
            })
        })
    })
}
