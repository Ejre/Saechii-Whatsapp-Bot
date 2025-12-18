import ffmpeg from 'fluent-ffmpeg'

/**
 * Convert gambar/video ke sticker webp
 */
export async function convertToSticker(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .outputOptions([
                '-y',
                '-vcodec', 'libwebp',
                // Filter: Scale fit, force RGBA (alpha), pad transparent
                '-vf', "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,setsar=1",
                '-loop', '0',
                '-ss', '0',
                '-t', '10',
                '-preset', 'default',
                '-an',
                '-vsync', '0',
                '-q:v', '80'
            ])
            .save(outputPath)
            .on('end', () => resolve(outputPath))
            .on('error', reject)
    })
}
