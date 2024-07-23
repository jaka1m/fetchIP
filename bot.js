require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');

const token = process.env.geo;
const bot = new Telegraf(token);

function isValidIpAddress(ip) {
    return /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip);
}

async function fetchProxyStatus(ip) {
    const apiUrl = `https://proxyip.edtunnel.best/api?ip=${ip}&host=speed.cloudflare.com&port=443&tls=true`;

    try {
        const response = await axios.get(apiUrl);
        console.log('Proxy Status Response:', response.data); // Debugging log
        return response.data;
    } catch (error) {
        console.error('Error fetching proxy status:', error.message);
        return { error: 'Failed to fetch proxy status' };
    }
}

async function fetchIpInformation(ip) {
    const apiUrl = `http://ip-api.com/json/${ip}`;

    try {
        const response = await axios.get(apiUrl);
        console.log('IP Information Response:', response.data); // Debugging log
        return response.data;
    } catch (error) {
        console.error('Error fetching IP data:', error.message);
        return { error: 'Failed to fetch IP information' };
    }
}

function formatIpInfo(ipInfo, ip, proxyStatus) {
    if (!ipInfo) {
        return `<b>Informasi IP tidak tersedia untuk IP: ${ip}</b>`;
    }

    const proxyStatusText = proxyStatus === undefined 
        ? 'N/A' 
        : (proxyStatus.proxyip ? 'ACTIVE ✅' : 'DEAD ❌');

    // Sesuaikan dengan struktur data dari API ip-api dan proxy status
    const labels = {
        IP: ipInfo.query || ip || 'N/A',
        OriginIP: ipInfo.query || 'N/A',
        ISP: ipInfo.isp || 'N/A',
        Country: `${ipInfo.country} (${ipInfo.countryCode})` || 'N/A',
        City: ipInfo.city || 'N/A',
        'Proxy Status': proxyStatusText
    };

    const maxLength = Math.max(...Object.keys(labels).map(label => label.length));
    
    let formattedInfo = '';
    for (const [label, value] of Object.entries(labels)) {
        formattedInfo += `<b>${label.padEnd(maxLength)}</b> : ${value}\n`;
    }

    return formattedInfo;
}

bot.start((ctx) => {
    const startMessage = `Halo! Saya adalah bot untuk mengecek alamat IP yang aktif untuk cloudflare worker.\n\nCara penggunaan :\nKirim IP tunggal atau 50-100 IP dipisahkan dengan (Comma, Space & Enter)\n\nContoh :\n1.1.1.1\n2.2.2.2\n3.3.3.3\n1.1.1.1 2.2.2.2 3.3.3.3\n1.1.1.1,2.2.2.2,3.3.3.3`;
    ctx.reply(startMessage);
});

bot.on('text', async (ctx) => {
    const message = ctx.message.text;
    const lines = message.split(/\s+|,|\n/);
    const ipAddresses = lines.filter(isValidIpAddress);

    if (ipAddresses.length === 0) {
        ctx.reply('Tidak ada alamat IP yang valid ditemukan.');
        return;
    }

    // Batasi maksimal 10 IP yang diproses dalam satu kali permintaan
    const maxBatchSize = 10;
    const batches = [];
    for (let i = 0; i < ipAddresses.length; i += maxBatchSize) {
        batches.push(ipAddresses.slice(i, i + maxBatchSize));
    }

    for (const batch of batches) {
        const loadingMessage = await ctx.reply('⏳');

        // Fetch proxy status first
        const proxyStatusPromises = batch.map(fetchProxyStatus);
        const proxyStatuses = await Promise.all(proxyStatusPromises);

        // Fetch IP information second
        const ipInfoPromises = batch.map(fetchIpInformation);
        const ipInfos = await Promise.all(ipInfoPromises);

        let response = '';
        for (let i = 0; i < batch.length; i++) {
            const ip = batch[i];
            const ipInfo = ipInfos[i];
            const proxyStatus = proxyStatuses[i];

            const status = proxyStatus.error ? 'Error fetching proxy status' : (proxyStatus.proxyip ? 'ACTIVE ✅' : 'DEAD ❌');

            if (ipInfo.error) {
                response += `<pre>Error: ${ipInfo.error}</pre>\n`;
            } else {
                const info = formatIpInfo(ipInfo, ip, proxyStatus);
                response += `<pre>${info}</pre>\n`;
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
