"use strict"

/**
 * ビットマップエディタ本体のメインクラス
 */
class BitmapEditor {
    constructor() {
        this.env = null
        this.drawingButton = -1
        this.currentToolKey = 'pencil'

        this.canvas = document.getElementById('paintCanvas')
        this.ctx = this.canvas.getContext('2d')
        this.realCanvas = document.getElementById('realSizePreview')
        this.realCtx = this.realCanvas.getContext('2d')

        this.paletteContainer = document.getElementById('palette')
        this.hiddenPicker = document.getElementById('hiddenColorPicker')
        this.fgIndicator = document.getElementById('fgIndicator')
        this.bgIndicator = document.getElementById('bgIndicator')
        this.coordsIndicator = document.getElementById('coordsIndicator')
        this.zoomRange = document.getElementById('zoomRange')
        this.zoomValue = document.getElementById('zoomValue')

        this.tools = {
            'pencil': new PencilTool(this),
            'line': new LineTool(this),
            'floodfill': new FloodFillTool(this)
        }

        this.init()
    }

    async init() {
        try {
            const response = await fetch('env.json')
            this.env = await response.json()
        } catch (e) {
            console.error("Failed to load env.json, applying minimal defaults", e)
            this.env = {
                editor: { defaultWidth: 16, defaultHeight: 16, defaultScale: 10, minSize: 1, maxSize: 128, maxZoom: 50 },
                palettes: { full: ["#000000", "#ffffff"], mono: ["#000000", "#ffffff"] },
                export: { defaultBmpFilename: "bitmap.bmp", defaultIcoFilename: "bitmap.ico", defaultPngFilename: "bitmap.png", defaultTextFilename: "bitmap_array.txt" }
            }
        }

        this.width = this.env.editor.defaultWidth
        this.height = this.env.editor.defaultHeight
        this.displayScale = this.env.editor.defaultScale
        this.colorMode = 'full'

        this.currentPalette = [...this.env.palettes.full]
        this.foregroundColor = this.currentPalette[0] || '#000000'
        this.backgroundColor = this.currentPalette[1] || '#ffffff'

        const widthInput = document.getElementById('widthInput')
        const heightInput = document.getElementById('heightInput')
        if (widthInput && heightInput) {
            widthInput.min = this.env.editor.minSize
            widthInput.max = this.env.editor.maxSize
            heightInput.min = this.env.editor.minSize
            heightInput.max = this.env.editor.maxSize
        }
        if (this.zoomRange) {
            this.zoomRange.max = this.env.editor.maxZoom
        }

        this.setupPalette()
        this.resizeCanvas(false)
        this.clearCanvas()
        this.updateIndicators()
        this.bindEvents()
    }

    bindEvents() {
        document.getElementById('btnNew').addEventListener('click', () => this.handleNew())
        document.getElementById('colorMode').addEventListener('change', (e) => this.handleModeChange(e.target.value))
        document.getElementById('saveFormat').addEventListener('change', (e) => this.handleSaveFormat(e.target.value))
        document.getElementById('btnExport').addEventListener('click', () => this.handleExport())

        this.zoomRange.addEventListener('input', (e) => {
            const val = parseInt(e.target.value) || 10
            this.displayScale = val
            this.zoomValue.innerText = `${val}x`
            this.resizeCanvas(true)
        })

        document.querySelectorAll('input[name="currentTool"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.currentToolKey = e.target.value
            })
        })

        this.canvas.addEventListener('mousedown', (e) => {
            if (e.ctrlKey) return
            if (e.button === 0 || e.button === 2) {
                this.drawingButton = e.button
                const { x, y } = this.getCanvasCoords(e)
                if (this.isValidCoords(x, y)) {
                    const activeTool = this.tools[this.currentToolKey]
                    if (activeTool) activeTool.onMouseDown(x, y, this.getTargetColor())
                }
            }
        })

        this.canvas.addEventListener('mousemove', (e) => {
            if (e.ctrlKey) { this.drawingButton = -1; return }
            this.updateCoords(e)
            if (this.drawingButton !== -1) {
                const { x, y } = this.getCanvasCoords(e)
                if (this.isValidCoords(x, y)) {
                    const activeTool = this.tools[this.currentToolKey]
                    if (activeTool) activeTool.onMouseMove(x, y, this.getTargetColor())
                }
            }
        })

        this.canvas.addEventListener('mouseleave', () => {
            this.coordsIndicator.innerText = 'X: --, Y: --'
        })

        window.addEventListener('mouseup', () => {
            this.drawingButton = -1
            const activeTool = this.tools[this.currentToolKey]
            if (activeTool) activeTool.onMouseUp()
        })

        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault()
            if (e.ctrlKey) this.showContextMenu(e.clientX, e.clientY)
        })
    }

    getCanvasCoords(e) {
        const rect = this.canvas.getBoundingClientRect()
        const x = Math.floor((e.clientX - rect.left) / this.displayScale)
        const y = Math.floor((e.clientY - rect.top) / this.displayScale)
        return { x, y }
    }

    isValidCoords(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height
    }

    syncRealSizePreview() {
        this.realCtx.clearRect(0, 0, this.width, this.height)
        this.realCtx.drawImage(this.canvas, 0, 0)
    }

    updateCoords(e) {
        const { x, y } = this.getCanvasCoords(e)
        if (this.isValidCoords(x, y)) {
            this.coordsIndicator.innerText = `X: ${String(x).padStart(2, ' ')}, Y: ${String(y).padStart(2, ' ')}`
        }
    }

    updateIndicators() {
        this.fgIndicator.style.backgroundColor = this.foregroundColor
        this.bgIndicator.style.backgroundColor = this.backgroundColor
    }

    showContextMenu(x, y) {
        const oldMenu = document.getElementById('customContextMenu')
        if (oldMenu) oldMenu.remove()

        const menu = document.createElement('div')
        menu.id = 'customContextMenu'
        menu.style.position = 'fixed'
        menu.style.left = `${x}px`
        menu.style.top = `${y}px`
        menu.style.backgroundColor = '#1a252f'
        menu.style.border = '1px solid #34495e'
        menu.style.borderRadius = '4px'
        menu.style.padding = '5px 0'
        menu.style.boxShadow = '0 2px 10px rgba(0,0,0,0.5)'
        menu.style.zIndex = '1000'
        menu.style.fontFamily = 'sans-serif'
        menu.style.fontSize = '13px'

        const items = [
            { text: 'キャンバスをクリア', action: () => this.clearCanvas() },
            { text: '色を反転する', action: () => this.invertCanvasColors() }
        ]

        items.forEach(item => {
            const div = document.createElement('div')
            div.innerText = item.text
            div.style.padding = '6px 15px'
            div.style.cursor = 'pointer'
            div.style.color = '#ecf0f1'

            div.addEventListener('mouseenter', () => div.style.backgroundColor = '#3498db')
            div.addEventListener('mouseleave', () => div.style.backgroundColor = 'transparent')
            div.addEventListener('click', () => {
                item.action()
                menu.remove()
            })
            menu.appendChild(div)
        })

        document.body.appendChild(menu)

        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove()
                document.removeEventListener('mousedown', closeMenu)
            }
        }
        setTimeout(() => document.addEventListener('mousedown', closeMenu), 10)
    }

    invertCanvasColors() {
        const imgData = this.ctx.getImageData(0, 0, this.width, this.height)
        const data = imgData.data
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 255 - data[i]
            data[i + 1] = 255 - data[i + 1]
            data[i + 2] = 255 - data[i + 2]
            if (this.colorMode === 'mono') data[i + 3] = 255
        }
        this.ctx.putImageData(imgData, 0, 0)
        this.syncRealSizePreview()
    }

    resizeCanvas(preserveData = false) {
        let savedData = null
        if (preserveData && this.canvas.width > 0 && this.canvas.height > 0) {
            try {
                savedData = this.ctx.getImageData(0, 0, this.width, this.height)
            } catch (e) { }
        }

        this.canvas.width = this.width
        this.canvas.height = this.height
        this.canvas.style.width = (this.width * this.displayScale) + 'px'
        this.canvas.style.height = (this.height * this.displayScale) + 'px'

        this.realCanvas.width = this.width
        this.realCanvas.height = this.height

        if (savedData) {
            this.ctx.putImageData(savedData, 0, 0)
        }
        this.syncRealSizePreview()
    }

    clearCanvas() {
        this.ctx.fillStyle = this.colorMode === 'mono' ? '#ffffff' : 'rgba(255,255,255,0)'
        this.ctx.fillRect(0, 0, this.width, this.height)
        this.syncRealSizePreview()
    }

    handleNew() {
        const max = this.env.editor.maxSize
        const min = this.env.editor.minSize
        let w = parseInt(document.getElementById('widthInput').value) || 16
        let h = parseInt(document.getElementById('heightInput').value) || 16

        this.width = Math.max(min, Math.min(max, w))
        this.height = Math.max(min, Math.min(max, h))

        this.resizeCanvas(false)
        this.clearCanvas()
        this.coordsIndicator.innerText = 'X: --, Y: --'
    }

    handleModeChange(newMode) {
        this.colorMode = newMode
        this.currentPalette = this.colorMode === 'mono' ? [...this.env.palettes.mono] : [...this.env.palettes.full]
        this.foregroundColor = this.currentPalette[0]
        this.backgroundColor = this.currentPalette[1] || '#ffffff'
        this.setupPalette()
        this.resizeCanvas(false)
        this.clearCanvas()
        this.updateIndicators()
        this.coordsIndicator.innerText = 'X: --, Y: --'
    }

    getClosestMonoColor(hex) {
        const r = parseInt(hex.slice(1, 3), 16)
        const g = parseInt(hex.slice(3, 5), 16)
        const b = parseInt(hex.slice(5, 7), 16)
        const brightness = (r * 299 + g * 587 + b * 114) / 1000
        return brightness < 128 ? '#000000' : '#ffffff'
    }

    getTargetColor() {
        let color = (this.drawingButton === 0) ? this.foregroundColor : this.backgroundColor
        if (this.colorMode === 'mono') color = this.getClosestMonoColor(color)
        return color
    }

    hexToRgba(hex) {
        if (hex.startsWith('rgba')) return [255, 255, 255, 0]
        const r = parseInt(hex.slice(1, 3), 16)
        const g = parseInt(hex.slice(3, 5), 16)
        const b = parseInt(hex.slice(5, 7), 16)
        return [r, g, b, 255]
    }

    setupPalette() {
        this.paletteContainer.innerHTML = ''
        this.currentPalette.forEach((color, index) => {
            const div = document.createElement('div')
            div.className = 'palette-color'
            div.setAttribute('data-color', color.toUpperCase())
            div.style.backgroundColor = color

            if (color === this.foregroundColor) div.classList.add('active-fg')
            if (color === this.backgroundColor) div.classList.add('active-bg')

            div.addEventListener('click', () => {
                this.foregroundColor = color
                this.setupPalette()
                this.updateIndicators()
            })

            div.addEventListener('contextmenu', (e) => {
                e.preventDefault()
                this.backgroundColor = color
                this.setupPalette()
                this.updateIndicators()
            })

            if (this.colorMode !== 'mono') {
                div.addEventListener('dblclick', () => {
                    this.hiddenPicker.value = color
                    this.hiddenPicker.oninput = (e) => {
                        let pickedColor = e.target.value
                        this.currentPalette[index] = pickedColor
                        div.style.backgroundColor = pickedColor
                        if (this.foregroundColor === color) this.foregroundColor = pickedColor
                        if (this.backgroundColor === color) this.backgroundColor = pickedColor
                        this.setupPalette()
                        this.updateIndicators()
                    }
                    this.hiddenPicker.click()
                })
            }
            this.paletteContainer.appendChild(div)
        })
    }

    handleSaveFormat(value) {
        const byte_format = document.querySelector('.byte-format')
        if (value === 'bytes') {
            byte_format.classList.remove('hidden')
        } else {
            // if (!byte_format.classList.contains('hidden')) {
                byte_format.classList.add('hidden')
            // }
        }
    }

    handleExport() {
        const format = document.getElementById('saveFormat').value
        const notation = document.getElementById('notationMode').value

        switch (format) {
            case 'png':
                const link = document.createElement('a')
                link.download = this.env.export.defaultPngFilename
                link.href = this.canvas.toDataURL('image/png')
                link.click()
                break
            case 'bmp':
                ImageExporter.exportBMP(this.ctx, this.width, this.height, this.colorMode, this.env.export.defaultBmpFilename)
                break
            case 'ico':
                ImageExporter.exportICO(this.ctx, this.width, this.height, this.env.export.defaultIcoFilename)
                break
            case 'bytes':
                ImageExporter.exportByteArray(this.ctx, this.width, this.height, this.colorMode, notation, this.env.export.defaultTextFilename)
                break
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new BitmapEditor()
})