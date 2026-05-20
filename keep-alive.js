const https = require("https");

const URL = "https://send-api-1v9v.onrender.com/health";
const INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

function ping() {
    const start = Date.now();
    https
        .get(URL, (res) => {
            const ms = Date.now() - start;
            console.log(`[${new Date().toISOString()}] ${res.statusCode} — ${ms}ms`);
            res.resume(); // drain response body
        })
        .on("error", (err) => {
            console.error(`[${new Date().toISOString()}] FAILED — ${err.message}`);
        });
}

console.log(`Keep-alive started — pinging ${URL} every 10 minutes`);
ping();
setInterval(ping, INTERVAL_MS);
// https://api.mypassa.xyz/webhooks/paystack