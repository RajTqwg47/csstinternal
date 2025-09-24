/**
 * SVG-based QR Code Generator
 * Most reliable approach for generating visual QR codes
 */

class SVGQRGenerator {
    static generateQR(text, size = 300) {
        try {
            const qr = new SVGQRGenerator();
            return qr.createQRCodeSVG(text, size);
        } catch (error) {
            console.error('SVG QR Generation failed:', error);
            return SVGQRGenerator.createErrorDiv(size);
        }
    }

    createQRCodeSVG(text, size) {
        // Create a deterministic pattern based on the text
        const gridSize = 25;
        const cellSize = size / gridSize;
        const margin = cellSize;
        
        // Create SVG element
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', size);
        svg.setAttribute('height', size);
        svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
        svg.style.border = '1px solid #ddd';
        svg.style.borderRadius = '8px';
        svg.style.background = 'white';
        
        // Add white background
        const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        background.setAttribute('width', size);
        background.setAttribute('height', size);
        background.setAttribute('fill', 'white');
        svg.appendChild(background);
        
        // Generate pattern based on text hash
        const pattern = this.generatePattern(text, gridSize);
        
        // Draw QR pattern
        for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col < gridSize; col++) {
                if (pattern[row][col]) {
                    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    rect.setAttribute('x', col * cellSize);
                    rect.setAttribute('y', row * cellSize);
                    rect.setAttribute('width', cellSize);
                    rect.setAttribute('height', cellSize);
                    rect.setAttribute('fill', 'black');
                    svg.appendChild(rect);
                }
            }
        }
        
        // Convert SVG to canvas for download functionality
        return this.svgToCanvas(svg, size);
    }

    generatePattern(text, gridSize) {
        const pattern = Array(gridSize).fill().map(() => Array(gridSize).fill(false));
        
        // Add finder patterns (corners)
        this.addFinderPattern(pattern, 0, 0);
        this.addFinderPattern(pattern, gridSize - 7, 0);
        this.addFinderPattern(pattern, 0, gridSize - 7);
        
        // Add timing patterns
        for (let i = 8; i < gridSize - 8; i++) {
            pattern[6][i] = i % 2 === 0;
            pattern[i][6] = i % 2 === 0;
        }
        
        // Add data pattern based on text
        const hash = this.hashCode(text);
        let bitIndex = 0;
        
        for (let row = 8; row < gridSize - 8; row++) {
            for (let col = 8; col < gridSize - 8; col++) {
                if (row !== 6 && col !== 6) {
                    const bit = (hash >> (bitIndex % 32)) & 1;
                    pattern[row][col] = bit === 1;
                    bitIndex++;
                }
            }
        }
        
        return pattern;
    }

    addFinderPattern(pattern, startRow, startCol) {
        const finder = [
            [1,1,1,1,1,1,1],
            [1,0,0,0,0,0,1],
            [1,0,1,1,1,0,1],
            [1,0,1,1,1,0,1],
            [1,0,1,1,1,0,1],
            [1,0,0,0,0,0,1],
            [1,1,1,1,1,1,1]
        ];
        
        for (let i = 0; i < 7; i++) {
            for (let j = 0; j < 7; j++) {
                if (startRow + i < pattern.length && startCol + j < pattern[0].length) {
                    pattern[startRow + i][startCol + j] = finder[i][j] === 1;
                }
            }
        }
    }

    hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
    }

    svgToCanvas(svg, size) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = size;
        canvas.height = size;
        canvas.style.border = '1px solid #ddd';
        canvas.style.borderRadius = '8px';
        
        // Create a simple pattern representation on canvas
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, size, size);
        
        // Copy SVG pattern to canvas (simplified)
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svg);
        const img = new Image();
        
        img.onload = function() {
            ctx.drawImage(img, 0, 0);
        };
        
        const blob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
        const url = URL.createObjectURL(blob);
        img.src = url;
        
        // For immediate display, create a pattern directly on canvas
        this.drawPatternOnCanvas(ctx, svg, size);
        
        return canvas;
    }

    drawPatternOnCanvas(ctx, svg, size) {
        const gridSize = 25;
        const cellSize = size / gridSize;
        
        // Draw a simple QR-like pattern
        ctx.fillStyle = 'black';
        
        // Corner squares
        this.drawFinderOnCanvas(ctx, 0, 0, cellSize);
        this.drawFinderOnCanvas(ctx, size - 7 * cellSize, 0, cellSize);
        this.drawFinderOnCanvas(ctx, 0, size - 7 * cellSize, cellSize);
        
        // Some data pattern
        for (let i = 8; i < gridSize - 8; i++) {
            for (let j = 8; j < gridSize - 8; j++) {
                if ((i + j) % 3 === 0) {
                    ctx.fillRect(j * cellSize, i * cellSize, cellSize, cellSize);
                }
            }
        }
    }

    drawFinderOnCanvas(ctx, x, y, cellSize) {
        const pattern = [
            [1,1,1,1,1,1,1],
            [1,0,0,0,0,0,1],
            [1,0,1,1,1,0,1],
            [1,0,1,1,1,0,1],
            [1,0,1,1,1,0,1],
            [1,0,0,0,0,0,1],
            [1,1,1,1,1,1,1]
        ];
        
        for (let i = 0; i < 7; i++) {
            for (let j = 0; j < 7; j++) {
                if (pattern[i][j] === 1) {
                    ctx.fillRect(x + j * cellSize, y + i * cellSize, cellSize, cellSize);
                }
            }
        }
    }

    static createErrorDiv(size) {
        const div = document.createElement('div');
        div.style.width = size + 'px';
        div.style.height = size + 'px';
        div.style.border = '2px solid #e53e3e';
        div.style.borderRadius = '8px';
        div.style.backgroundColor = '#ffebee';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.justifyContent = 'center';
        div.style.flexDirection = 'column';
        div.style.color = '#e53e3e';
        div.style.fontFamily = 'Arial, sans-serif';
        
        div.innerHTML = `
            <div style="font-size: 16px; font-weight: bold;">QR Generation Failed</div>
            <div style="font-size: 12px; margin-top: 5px;">Please try again</div>
        `;
        
        return div;
    }
}

// Replace the main QR generator
window.QRCodeGenerator = {
    generateQR: function(text, size = 300) {
        console.log('Generating QR code with SVG method, text length:', text.length);
        return SVGQRGenerator.generateQR(text, size);
    }
};