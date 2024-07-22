require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');

const token = process.env.TELEGRAM_BOT_TOKEN;
const ownerId = process.env.OWNER_ID;
const bot = new Telegraf(token);

function isValidIpAddress(ip) {
    return /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip);
}

async function fetchIpInformation(ip) {
    const apiUrl = `http://api.xsmnet.buzz/api?key=xsm&ip=${ip}`;

    try {
        const response = await axios.get(apiUrl);
        return response.data;
    } catch (error) {
        console.error('Error fetching IP data:', error.message);
        return { error: 'Failed to fetch IP information' };
    }
}

function formatIpInfo(ipInfo, ip) {
    if (!ipInfo) {
        return `<b>Informasi IP tidak tersedia untuk IP: ${ip}</b>`;
    }

    const labels = {
        IP: ipInfo.ip || 'N/A',
        OriginIP: ipInfo.originIp || 'N/A',
        ISP: ipInfo.isp || 'N/A',
        Country: ipInfo.country || 'N/A',
        City: ipInfo.city || 'N/A',
        'Proxy Status': ipInfo.proxyStatus || 'N/A'
    };

    const maxLength = Math.max(...Object.keys(labels).map(label => label.length));
    
    let formattedInfo = '';
    for (const [label, value] of Object.entries(labels)) {
        formattedInfo += `<b>${label.padEnd(maxLength)}</b> : ${value}\n`;
    }

    return formattedInfo;
}

async function logUserAccess(ctx) {
    const userId = ctx.from.id;
    const username = ctx.from.username || 'N/A';
    const timestamp = new Date(ctx.message.date * 1000).toISOString();
    const message = `User ID: ${userId}, Username: ${username}, Timestamp: ${timestamp}`;
    
    try {
        await bot.telegram.sendMessage(ownerId, message);
    } catch (error) {
        console.error('Error logging user access:', error.message);
    }
}

bot.start(async (ctx) => {
    const startMessage = `Halo! Saya adalah bot untuk mengecek alamat IP yang aktif untuk cloudflare worker.\n\nCara penggunaan :\nKirim IP tunggal atau 50-100 IP dipisahkan dengan (Comma, Space & Enter)\n\nContoh :\n1.1.1.1\n2.2.2.2\n3.3.3.3\n1.1.1.1 2.2.2.2 3.3.3.3\n1.1.1.1,2.2.2.2,3.3.3.3`;
    ctx.reply(startMessage);

    // Log user access
    await logUserAccess(ctx);
});

bot.on('text', async (ctx) => {
    const message = ctx.message.text;
    const lines = message.split(/\s+|,|\n/);
    const ipAddresses = lines.filter(isValidIpAddress);

    if (ipAddresses.length === 0) {
        ctx.reply('Tidak ada alamat IP yang valid ditemukan.');
        return;
    }

    // Log user access
    await logUserAccess(ctx);

    // Batasi maksimal 10 IP yang diproses dalam satu kali permintaan
    const maxBatchSize = 10;
    const batches = [];
    for (let i = 0; i < ipAddresses.length; i += maxBatchSize) {
        batches.push(ipAddresses.slice(i, i + maxBatchSize));
    }

    for (const batch of batches) {
        const loadingMessage = await ctx.reply('⏳');

        const ipInfoPromises = batch.map(fetchIpInformation);
        const ipInfos = await Promise.all(ipInfoPromises);

        let response = '';
        for (let i = 0; i < ipInfos.length; i++) {
            const ipInfo = ipInfos[i];
            if (ipInfo.error) {
                response += `<pre>Error: ${ipInfo.error}</pre>\n`;
            } else {
                response += `<pre>${formatIpInfo(ipInfo, batch[i])}</pre>\n`;
            }
        }

        // Perbarui pesan loading dengan hasil pemindaian
        await ctx.telegram.editMessageText(ctx.chat.id, loadingMessage.message_id, null, response, { parse_mode: 'HTML' }).catch((error) => {
            console.error('Error updating message:', error.message);
        });
    }
});

bot.catch((err, ctx) => {
    console.error('Error handling update:', err);
});

bot.launch().then(() => {
    console.log('Bot sedang berjalan. Tekan Ctrl+C untuk menghentikan.');
}).catch((err) => {
    console.error('Error starting bot:', err);
});
