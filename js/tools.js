"use strict"

/**
 * 描画ツールのインターフェース定義（ベースクラス）
 */
class DrawTool {
    /**
     * @param {BitmapEditor} editor エディタのメインインスタンス
     */
    constructor(editor) {
        this.editor = editor
    }

    /**
     * マウスボタンが押されたときの処理
     * @param {number} x キャンバス上のX座標
     * @param {number} y キャンバス上のY座標
     * @param {string} color 描画する色（HEX文字列）
     */
    onMouseDown(x, y, color) {}

    /**
     * マウスが移動したときの処理
     * @param {number} x キャンバス上のX座標
     * @param {number} y キャンバス上のY座標
     * @param {string} color 描画する色（HEX文字列）
     */
    onMouseMove(x, y, color) {}

    /**
     * マウスボタンが離されたときの処理
     */
    onMouseUp() {}
}


/**
 * 鉛筆（ペンシル）ツールクラス
 */
class PencilTool extends DrawTool {
    onMouseDown(x, y, color) {
        this.drawPixel(x, y, color)
    }

    onMouseMove(x, y, color) {
        this.drawPixel(x, y, color)
    }

    drawPixel(x, y, color) {
        this.editor.ctx.fillStyle = color
        this.editor.ctx.fillRect(x, y, 1, 1)
        this.editor.syncRealSizePreview()
    }
}


/**
 * 直線（ライン）ツールクラス
 */
class LineTool extends DrawTool {
    constructor(editor) {
        super(editor)
        this.startX = 0
        this.startY = 0
        this.snapshot = null
    }

    onMouseDown(x, y, color) {
        this.startX = x
        this.startY = y
        // ドラッグ中のプレビュー描画用に現在のキャンバス状態を保存
        this.snapshot = this.editor.ctx.getImageData(0, 0, this.editor.width, this.editor.height)
        this.drawLine(x, y, color)
    }

    onMouseMove(x, y, color) {
        if (!this.snapshot) return
        // 一度ドラッグ開始時点の状態に戻してから新しい直線をプレビュー描画する
        this.editor.ctx.putImageData(this.snapshot, 0, 0)
        this.drawLine(x, y, color)
    }

    onMouseUp() {
        this.snapshot = null
    }

    drawLine(endX, endY, color) {
        this.editor.ctx.fillStyle = color
        
        // ブレゼンハムの直線アルゴリズムによるピクセルプロット
        let x0 = this.startX
        let y0 = this.startY
        const x1 = endX
        const y1 = endY

        const dx = Math.abs(x1 - x0)
        const dy = Math.abs(y1 - y0)
        const sx = (x0 < x1) ? 1 : -1
        const sy = (y0 < y1) ? 1 : -1
        let err = dx - dy

        while (true) {
            this.editor.ctx.fillRect(x0, y0, 1, 1)

            if (x0 === x1 && y0 === y1) break
            const e2 = 2 * err
            if (e2 > -dy) {
                err -= dy
                x0 += sx
            }
            if (e2 < dx) {
                err += dx
                y0 += sy
            }
        }
        this.editor.syncRealSizePreview()
    }
}


/**
 * 塗り潰し（バケツ）ツールクラス
 */
class FloodFillTool extends DrawTool {
    onMouseDown(x, y, color) {
        this.floodFill(x, y, color)
        this.editor.syncRealSizePreview()
        this.editor.drawingButton = -1
    }

    floodFill(startX, startY, fillHex) {
        const width = this.editor.width
        const height = this.editor.height
        const imgData = this.editor.ctx.getImageData(0, 0, width, height)
        const data = imgData.data

        const startIdx = (startY * width + startX) * 4
        const startR = data[startIdx]
        const startG = data[startIdx + 1]
        const startB = data[startIdx + 2]
        const startA = data[startIdx + 3]

        const [fillR, fillG, fillB, fillA] = this.editor.hexToRgba(fillHex)

        if (startR === fillR && startG === fillG && startB === fillB && startA === fillA) {
            return
        }

        const queue = [[startX, startY]]

        while (queue.length > 0) {
            const [cx, cy] = queue.pop()
            const idx = (cy * width + cx) * 4

            if (data[idx] === startR && data[idx + 1] === startG && data[idx + 2] === startB && data[idx + 3] === startA) {
                data[idx] = fillR
                data[idx + 1] = fillG
                data[idx + 2] = fillB
                data[idx + 3] = fillA

                if (cx + 1 < width) queue.push([cx + 1, cy])
                if (cx - 1 >= 0) queue.push([cx - 1, cy])
                if (cy + 1 < height) queue.push([cx, cy + 1])
                if (cy - 1 >= 0) queue.push([cx, cy - 1])
            }
        }

        this.editor.ctx.putImageData(imgData, 0, 0)
    }
}