// Script to generate QuizPro PWA icons as PNG files
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function generateIcon(size) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Background gradient (purple)
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, '#7c3aed');
    grad.addColorStop(1, '#4f46e5');
    ctx.fillStyle = grad;

    // Rounded rect
    const r = size * 0.22;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.arcTo(size, 0, size, size, r);
    ctx.arcTo(size, size, 0, size, r);
    ctx.arcTo(0, size, 0, 0, r);
    ctx.arcTo(0, 0, size, 0, r);
    ctx.closePath();
    ctx.fill();

    // Trophy emoji
    ctx.font = `${size * 0.55}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏆', size / 2, size / 2 + size * 0.03);

    return canvas.toBuffer('image/png');
}

const iconsDir = path.join(__dirname, 'public', 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

[192, 512].forEach(size => {
    const buf = generateIcon(size);
    const outPath = path.join(iconsDir, `icon-${size}.png`);
    fs.writeFileSync(outPath, buf);
    console.log(`✅ Created ${outPath}`);
});
