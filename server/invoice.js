const PDFDocument = require('pdfkit');
const path = require('path');

const fontFile = weight => path.join(path.dirname(require.resolve('@fontsource/noto-sans-bengali/package.json')), 'files', `noto-sans-bengali-bengali-${weight}-normal.woff`);
const colors = { burgundy: '#68283b', deep: '#481a2b', cherry: '#c9344b', cream: '#fff8ed', line: '#ead9ca', ink: '#34221f', muted: '#796b65' };
const bengali = /[ঀ-৿]/;

// Splits text into Bengali / non-Bengali runs because the Bengali font has no Latin glyphs.
function runsOf(value) {
    const runs = [];
    for (const char of String(value)) {
        const script = bengali.test(char) ? 'bn' : 'latin';
        if (runs.length && runs[runs.length - 1].script === script) runs[runs.length - 1].text += char;
        else runs.push({ script, text: char });
    }
    return runs;
}

function buildInvoice(order) {
    const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: `Booka-Ru invoice ${order._id}`, Author: 'Booka-Ru' } });
    doc.registerFont('bn', fontFile(400));
    doc.registerFont('bn-bold', fontFile(700));
    const pick = (script, bold) => script === 'bn' ? (bold ? 'bn-bold' : 'bn') : (bold ? 'Helvetica-Bold' : 'Helvetica');

    const widthOf = (value, size, bold) => runsOf(value).reduce((sum, run) => sum + doc.font(pick(run.script, bold)).fontSize(size).widthOfString(run.text), 0);
    const write = (value, x, y, { size = 10, bold = false, color = colors.ink, align = 'left', width = 0 } = {}) => {
        let cursor = align === 'right' ? x + width - widthOf(value, size, bold) : x;
        doc.fillColor(color);
        runsOf(value).forEach(run => {
            doc.font(pick(run.script, bold)).fontSize(size).text(run.text, cursor, y, { lineBreak: false });
            cursor += doc.widthOfString(run.text);
        });
    };
    const fit = (value, size, maxWidth, bold) => {
        let text = String(value || '');
        while (text.length > 1 && widthOf(text, size, bold) > maxWidth) text = text.slice(0, -2) + '…';
        return text;
    };

    const left = 48, right = 547, wide = right - left;
    const money = value => `BDT ${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const date = new Date(order.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

    doc.rect(0, 0, 595.28, 841.89).fill(colors.cream);
    doc.rect(0, 0, 595.28, 120).fill(colors.burgundy);
    doc.rect(0, 120, 595.28, 5).fill(colors.cherry);
    write('Booka-Ru', left, 38, { size: 28, bold: true, color: '#ffffff' });
    write('Stories for every season', left, 74, { size: 10, color: '#f8e3e2' });
    write('INVOICE', left, 40, { size: 24, bold: true, color: '#ffffff', align: 'right', width: wide });
    write(`#${String(order._id).slice(-8).toUpperCase()}`, left, 74, { size: 11, color: '#f8e3e2', align: 'right', width: wide });

    write('BILLED TO', left, 160, { size: 8, bold: true, color: colors.cherry });
    write(order.customerName, left, 176, { size: 14, bold: true, color: colors.deep });
    write(order.email, left, 196, { size: 10, color: colors.muted });
    if (order.shippingAddress) write(fit(order.shippingAddress, 10, 250), left, 212, { size: 10, color: colors.muted });

    const metaX = 360, metaW = right - metaX;
    [['Invoice date', date], ['Order status', String(order.status || '').toUpperCase()], ['Invoice no.', String(order._id)]].forEach(([label, value], index) => {
        const y = 160 + index * 22;
        write(label, metaX, y, { size: 9, color: colors.muted });
        write(fit(value, 9, metaW - 70, true), metaX, y, { size: 9, bold: true, align: 'right', width: metaW });
    });

    const tableTop = 262;
    doc.roundedRect(left, tableTop, wide, 28, 6).fill(colors.burgundy);
    write('BOOK', left + 14, tableTop + 10, { size: 8, bold: true, color: '#ffffff' });
    write('QTY', 330, tableTop + 10, { size: 8, bold: true, color: '#ffffff', align: 'right', width: 40 });
    write('UNIT PRICE', 380, tableTop + 10, { size: 8, bold: true, color: '#ffffff', align: 'right', width: 80 });
    write('AMOUNT', 470, tableTop + 10, { size: 8, bold: true, color: '#ffffff', align: 'right', width: 63 });

    const rowTop = tableTop + 28;
    doc.rect(left, rowTop, wide, 50).fill('#ffffff');
    doc.moveTo(left, rowTop + 50).lineTo(right, rowTop + 50).lineWidth(1).strokeColor(colors.line).stroke();
    write(fit(order.name, 12, 270, true), left + 14, rowTop + 19, { size: 12, bold: true, color: colors.deep });
    write(String(order.quantity), 330, rowTop + 20, { size: 11, align: 'right', width: 40 });
    write(money(order.price), 380, rowTop + 20, { size: 11, align: 'right', width: 80 });
    write(money(order.total), 470, rowTop + 20, { size: 11, bold: true, align: 'right', width: 63 });

    const totalTop = rowTop + 74;
    doc.roundedRect(330, totalTop, right - 330, 44, 8).fill(colors.deep);
    write('TOTAL DUE', 346, totalTop + 17, { size: 9, bold: true, color: '#f8e3e2' });
    write(money(order.total), 346, totalTop + 14, { size: 15, bold: true, color: '#ffffff', align: 'right', width: right - 346 - 16 });

    write('Thank you for shopping with Booka-Ru.', left, 700, { size: 12, bold: true, color: colors.burgundy });
    write('Questions about this order? Open My orders and chat with our support team.', left, 720, { size: 9, color: colors.muted });
    doc.moveTo(left, 770).lineTo(right, 770).lineWidth(1).strokeColor(colors.line).stroke();
    write('Booka-Ru · A home for curious minds · Dhaka, Bangladesh', left, 782, { size: 8, color: colors.muted });
    write('Computer generated invoice', left, 782, { size: 8, color: colors.muted, align: 'right', width: wide });
    return doc;
}

module.exports = { buildInvoice };
