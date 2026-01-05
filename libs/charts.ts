import { createCanvas, loadImage } from 'canvas';

export interface ChartItem {
    name: string;
    secondary?: string; // Artist name for albums/tracks
    playcount: string;
    imageUrl: string | null;
}

export async function generateChart(items: ChartItem[], dim: number): Promise<Buffer> {
    const cellSize = 300;
    const canvas = createCanvas(dim * cellSize, dim * cellSize);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#101010';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const drawPromises = items.map(async (item, index) => {
        const x = (index % dim) * cellSize;
        const y = Math.floor(index / dim) * cellSize;

        try {
            if (item.imageUrl) {
                const img = await loadImage(item.imageUrl);
                // Draw image cropped to square
                const size = Math.min(img.width, img.height);
                const sx = (img.width - size) / 2;
                const sy = (img.height - size) / 2;
                ctx.drawImage(img, sx, sy, size, size, x, y, cellSize, cellSize);
            } else {
                // Placeholder for missing image
                ctx.fillStyle = '#202020';
                ctx.fillRect(x, y, cellSize, cellSize);
                ctx.fillStyle = '#555555';
                ctx.font = '24px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('No Image', x + cellSize / 2, y + cellSize / 2);
            }
        } catch (err) {
            // Fallback for failed image load
            ctx.fillStyle = '#202020';
            ctx.fillRect(x, y, cellSize, cellSize);
        }

        // Overlay for text
        const gradient = ctx.createLinearGradient(x, y + cellSize * 0.6, x, y + cellSize);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.8)');
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y + cellSize * 0.6, cellSize, cellSize * 0.4);

        // Labels
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';

        // Name
        ctx.font = 'bold 20px sans-serif';
        const name = item.name.length > 25 ? item.name.substring(0, 22) + '...' : item.name;
        ctx.fillText(name, x + 10, y + cellSize - 35);

        // Playcount
        ctx.font = '16px sans-serif';
        ctx.fillText(`${item.playcount} plays`, x + 10, y + cellSize - 10);

        // Secondary (Artist)
        if (item.secondary) {
            ctx.font = 'italic 16px sans-serif';
            const secondary = item.secondary.length > 30 ? item.secondary.substring(0, 27) + '...' : item.secondary;
            ctx.fillText(secondary, x + cellSize - ctx.measureText(secondary).width - 10, y + cellSize - 10);
        }
    });

    await Promise.all(drawPromises);

    return canvas.toBuffer('image/png');
}
