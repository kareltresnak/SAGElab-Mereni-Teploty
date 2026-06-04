import express from 'express';
import sqlite3 from 'sqlite3';
import cors from 'cors';
// --- INICIALIZACE A INFRASTRUKTURA ---
const app = express();
const PORT = 8132;
app.use(cors());
app.use(express.json());
const db = new (sqlite3.verbose().Database)('databaze.sqlite', (err) => {
    if (err) {
        console.error("Kritická chyba databáze:", err.message);
        process.exit(1);
    }
    console.log('Připojeno k SQLite databázi.');
    initSchema();
});
function initSchema() {
    db.run(`CREATE TABLE IF NOT EXISTS mereni (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id INTEGER,
        device_name TEXT,
        temperature REAL,
        timestamp DATETIME DEFAULT (datetime('now', 'localtime'))
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS prikazy (
        device_id INTEGER PRIMARY KEY,
        prikaz_blink INTEGER DEFAULT 0
    )`);
}
// --- API ENDPOINTY ---
app.get('/api/data', (_req, res) => {
    db.all('SELECT * FROM mereni ORDER BY timestamp DESC LIMIT 100', [], (err, rows) => {
        if (err) {
            console.error("SQL Error [/api/data]:", err.message);
            // Zásada Zero Information Disclosure - klientovi nikdy neposíláme stack trace!
            return res.status(500).json({ error: "Interní chyba serveru." });
        }
        res.json(rows);
    });
});
app.post('/api/command/blink', (req, res) => {
    const { device_id } = req.body;
    if (device_id === undefined || typeof device_id !== 'number') {
        return res.status(400).json({ error: "Chybí nebo je neplatný 'device_id'." });
    }
    console.log(`Web žádá bliknutí pro zařízení ID: ${device_id}`);
    const sql = 'INSERT OR REPLACE INTO prikazy (device_id, prikaz_blink) VALUES (?, 1)';
    db.run(sql, [device_id], function (err) {
        if (err) {
            console.error("SQL Error [/api/command/blink]:", err.message);
            return res.status(500).json({ error: "Chyba při zápisu do fronty." });
        }
        res.status(202).json({ message: `Příkaz pro ID ${device_id} zařazen do fronty.` });
    });
});
app.post('/api/data', (req, res) => {
    const { device_id, device_name, temperature } = req.body;
    if (temperature === undefined || device_id === undefined) {
        return res.status(400).json({ error: "Chybí povinná data (device_id, temperature)." });
    }
    const safeDeviceName = device_name || 'Nezname';
    const sqlInsert = 'INSERT INTO mereni (device_id, device_name, temperature) VALUES (?, ?, ?)';
    db.run(sqlInsert, [device_id, safeDeviceName, temperature], function (err) {
        if (err) {
            console.error("SQL Error [Insert Mereni]:", err.message);
            return res.status(500).json({ error: "Chyba při ukládání měření." });
        }
        console.log(`Uloženo [${device_id} - ${safeDeviceName}] - Teplota: ${temperature}°C.`);
        const sqlCheck = 'SELECT prikaz_blink FROM prikazy WHERE device_id = ?';
        db.get(sqlCheck, [device_id], (err, row) => {
            let ma_bliknout = false;
            if (err) {
                console.error("SQL Error [Check Prikazy]:", err.message);
            }
            else if (row && row.prikaz_blink === 1) {
                ma_bliknout = true;
                // Asynchronní operace na pozadí, neblokujeme odpověď klientovi
                db.run('UPDATE prikazy SET prikaz_blink = 0 WHERE device_id = ?', [device_id]);
            }
            res.status(201).json({
                message: "Teplota uložena!",
                blink: ma_bliknout
            });
        });
    });
});
app.get('/api/data/filter', (req, res) => {
    const { device_id, device_name, temp_min, temp_max, date_from, date_to, limit } = req.query;
    let query = `SELECT id, device_id, device_name, temperature, timestamp FROM mereni WHERE 1=1`;
    const params = [];
    if (device_id) {
        const id = parseInt(device_id, 10);
        if (!isNaN(id)) {
            query += ` AND device_id = ?`;
            params.push(id);
        }
    }
    if (device_name) {
        query += ` AND device_name LIKE ?`;
        params.push(`%${device_name}%`);
    }
    if (temp_min) {
        const min = parseFloat(temp_min);
        if (!isNaN(min)) {
            query += ` AND temperature >= ?`;
            params.push(min);
        }
    }
    if (temp_max) {
        const max = parseFloat(temp_max);
        if (!isNaN(max)) {
            query += ` AND temperature <= ?`;
            params.push(max);
        }
    }
    if (date_from) {
        query += ` AND timestamp >= ?`;
        params.push(date_from);
    }
    if (date_to) {
        query += ` AND timestamp <= ?`;
        params.push(date_to);
    }
    query += ` ORDER BY timestamp DESC`;
    const rowLimit = limit ? parseInt(limit, 10) : 100;
    query += ` LIMIT ?`;
    params.push(Number.isNaN(rowLimit) ? 100 : rowLimit);
    db.all(query, params, (err, rows) => {
        if (err) {
            console.error("SQL Error [Filter]:", err.message);
            return res.status(500).json({ error: 'Chyba při filtraci databáze' });
        }
        res.json(rows);
    });
});
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server naslouchá na síťovém rozhraní 0.0.0.0:${PORT}`);
});
