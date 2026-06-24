"use strict"

/**
 * 各種フォーマットへのバイナリエクスポートを担当するクラス
 */
class ImageExporter {
    static triggerDownload(blob, filename) {
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = filename
        link.click()
        URL.revokeObjectURL(link.href)
    }

    static write16(view, offset, value) { view.setUint16(offset, value, true) }
    static write32(view, offset, value) { view.setUint32(offset, value, true) }

    static exportBMP(ctx, width, height, colorMode, filename) {
        const imgData = ctx.getImageData(0, 0, width, height)
        const data = imgData.data

        const is1Bit = (colorMode === 'mono')
        const rowSize = is1Bit ? Math.floor((width + 31) / 32) * 4 : Math.floor((width * 3 + 3) / 4) * 4
        const pixelDataSize = rowSize * height

        const headerSize = 54
        const paletteSize = is1Bit ? 8 : 0
        const fileSize = headerSize + paletteSize + pixelDataSize

        const buffer = new ArrayBuffer(fileSize)
        const view = new DataView(buffer)

        view.setUint8(0, 0x42)
        view.setUint8(1, 0x4D)
        this.write32(view, 2, fileSize)
        this.write16(view, 6, 0)
        this.write16(view, 8, 0)
        this.write32(view, 10, headerSize + paletteSize)

        this.write32(view, 14, 40)
        this.write32(view, 18, width)
        this.write32(view, 22, height)
        this.write16(view, 26, 1)
        this.write16(view, 28, is1Bit ? 1 : 24)
        this.write32(view, 30, 0)
        this.write32(view, 34, pixelDataSize)
        this.write32(view, 38, 2835)
        this.write32(view, 42, 2835)
        this.write32(view, 46, is1Bit ? 2 : 0)
        this.write32(view, 50, 0)

        let offset = headerSize
        if (is1Bit) {
            view.setUint8(offset++, 0)
            view.setUint8(offset++, 0)
            view.setUint8(offset++, 0)
            view.setUint8(offset++, 0)
            view.setUint8(offset++, 255)
            view.setUint8(offset++, 255)
            view.setUint8(offset++, 255)
            view.setUint8(offset++, 0)
        }

        for (let y = height - 1; y >= 0; y--) {
            let rowOffset = offset + (height - 1 - y) * rowSize
            if (is1Bit) {
                let currentByte = 0
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4
                    const bit = ((data[idx] + data[idx + 1] + data[idx + 2]) / 3 < 128) ? 0 : 1

                    currentByte |= (bit << (7 - (x % 8)))
                    if (x % 8 === 7 || x === width - 1) {
                        view.setUint8(rowOffset + Math.floor(x / 8), currentByte)
                        currentByte = 0
                    }
                }
            } else {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4
                    view.setUint8(rowOffset + x * 3, data[idx + 2])
                    view.setUint8(rowOffset + x * 3 + 1, data[idx + 1])
                    view.setUint8(rowOffset + x * 3 + 2, data[idx])
                }
            }
        }

        const blob = new Blob([buffer], { type: 'image/bmp' })
        this.triggerDownload(blob, filename)
    }

    static exportICO(ctx, width, height, filename) {
        const imgData = ctx.getImageData(0, 0, width, height)
        const data = imgData.data

        const bmpHeaderSize = 40
        const iconXorSize = width * height * 4
        const iconAndSize = Math.floor((width + 31) / 32) * 4 * height
        const bmpSize = bmpHeaderSize + iconXorSize + iconAndSize
        const fileSize = 6 + 16 + bmpSize

        const buffer = new ArrayBuffer(fileSize)
        const view = new DataView(buffer)

        this.write16(view, 0, 0)
        this.write16(view, 2, 1)
        this.write16(view, 4, 1)

        view.setUint8(6, width >= 256 ? 0 : width)
        view.setUint8(7, height >= 256 ? 0 : height)
        view.setUint8(8, 0)
        view.setUint8(9, 0)
        this.write16(view, 10, 1)
        this.write16(view, 12, 32)
        this.write32(view, 14, bmpSize)
        this.write32(view, 18, 22)

        let offset = 22
        this.write32(view, offset, 40)
        this.write32(view, offset + 4, width)
        this.write32(view, offset + 8, height * 2)
        this.write16(view, offset + 12, 1)
        this.write16(view, offset + 14, 32)
        this.write32(view, offset + 16, 0)
        this.write32(view, offset + 20, iconXorSize + iconAndSize)
        this.write32(view, offset + 24, 0)
        this.write32(view, offset + 28, 0)
        this.write32(view, offset + 32, 0)
        this.write32(view, offset + 36, 0)

        offset += 40

        for (let y = height - 1; y >= 0; y--) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4
                view.setUint8(offset++, data[idx + 2])
                view.setUint8(offset++, data[idx + 1])
                view.setUint8(offset++, data[idx])
                view.setUint8(offset++, data[idx + 3])
            }
        }

        const andRowSize = Math.floor((width + 31) / 32) * 4
        for (let y = 0; y < height; y++) {
            for (let r = 0; r < andRowSize; r++) {
                view.setUint8(offset++, 0x00)
            }
        }

        const blob = new Blob([buffer], { type: 'image/x-icon' })
        this.triggerDownload(blob, filename)
    }

    static exportByteArray(ctx, width, height, colorMode, notationMode, filename) {
        const imgData = ctx.getImageData(0, 0, width, height)
        const data = imgData.data

        // 指定された進数モードに応じて数値を文字列に変換するヘルパー関数
        const formatNumber = (val) => {
            if (notationMode === 'oct') {
                return '0' + val.toString(8)
            } else if (notationMode === 'bin') {
                return '0b' + val.toString(2).padStart(8, '0')
            } else {
                return '0x' + val.toString(16).padStart(2, '0').toUpperCase()
            }
        }

        let out = `// Bitmap Data: ${width}x${height}, Mode: ${colorMode}, Notation: ${notationMode}\n`
        out += `const unsigned char bitmap_data[] = {\n`

        // モノクロモードかつ幅が8の倍数「ではない」場合は、1ピクセルずつ数値化して処理する
        if (colorMode === 'mono' && width % 8 !== 0) {
            for (let y = 0; y < height; y++) {
                out += "    "
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4
                    const bit = ((data[idx] + data[idx + 1] + data[idx + 2]) / 3 < 128) ? 0 : 1
                    out += formatNumber(bit) + ", "
                }
                out += "\n"
            }
        } 
        // モノクロモードかつ幅が8の倍数の場合は、従来どおり8ピクセルを1バイトにパック
        else if (colorMode === 'mono' && width % 8 === 0) {
            for (let y = 0; y < height; y++) {
                out += "    "
                let currentByte = 0
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4
                    const bit = ((data[idx] + data[idx + 1] + data[idx + 2]) / 3 < 128) ? 0 : 1
                    currentByte |= (bit << (7 - (x % 8)))
                    
                    if (x % 8 === 7 || x === width - 1) {
                        out += formatNumber(currentByte) + ", "
                        currentByte = 0
                    }
                }
                out += "\n"
            }
        } 
        // フルカラー（グレースケール変換出力）の場合
        else {
            for (let y = 0; y < height; y++) {
                out += "    "
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4
                    const gray = Math.round(data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114)
                    out += formatNumber(gray) + ", "
                }
                out += "\n"
            }
        }
        out += `};`

        const blob = new Blob([out], { type: 'text/plain' })
        this.triggerDownload(blob, filename)
    }
}