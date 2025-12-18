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
