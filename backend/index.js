const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const PORT = 8132;

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('databaze.sqlite', (err) => {
  if (err) {
    console.error("Chyba databaze:", err.message);
  } else {
    console.log('Pripojeno k SQLite databazi.');
    vytvorTabulky();
  }
});

function vytvorTabulky() {
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

app.get('/data', (req, res) => {
  db.all('SELECT * FROM mereni ORDER BY timestamp DESC LIMIT 100', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/command/blink', (req, res) => {
  const { device_id } = req.body;

  if (device_id === undefined) {
    return res.status(400).json({ error: "Chybi 'device_id'." });
  }

  console.log(`Web zada bliknuti pro zarizeni ID: ${device_id}`);

  const sql = 'INSERT OR REPLACE INTO prikazy (device_id, prikaz_blink) VALUES (?, 1)';
  db.run(sql, [device_id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: `Prikaz pro ID ${device_id} zařazen do fronty.` });
  });
});

app.post('/data', (req, res) => {
  const { device_id, device_name, temperature } = req.body;

  if (temperature === undefined || device_id === undefined) {
    return res.status(400).json({ error: "Chybi data." });
  }

  const sqlInsert = 'INSERT INTO mereni (device_id, device_name, temperature) VALUES (?, ?, ?)';
  db.run(sqlInsert, [device_id, device_name || 'Nezname', temperature], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    
    console.log(`Ulozeno [${device_id} - ${device_name}] - Teplota: ${temperature}°C.`);

    const sqlCheck = 'SELECT prikaz_blink FROM prikazy WHERE device_id = ?';
    db.get(sqlCheck, [device_id], (err, row) => {
      let ma_bliknout = false;

      if (err) {
        console.error("Chyba pri kontrole prikazu:", err.message);
      } else if (row && row.prikaz_blink === 1) {
        ma_bliknout = true;

        db.run('UPDATE prikazy SET prikaz_blink = 0 WHERE device_id = ?', [device_id]);
      }

      res.status(201).json({
        message: "Teplota ulozena!",
        blink: ma_bliknout 
      });
    });
  });
});

app.get('/data/filter', (req, res) => {
    const { device_id, device_name, temp_min, temp_max, date_from, date_to, limit } = req.query;

    let query = `SELECT id, device_id, device_name, temperature, timestamp FROM mereni WHERE 1=1`;
    let params = [];

    if (device_id) {
        query += ` AND device_id = ?`;
        params.push(device_id);
    }
    if (device_name) {
        query += ` AND device_name LIKE ?`;
        params.push(`%${device_name}%`);
    }
    if (temp_min) {
        query += ` AND temperature >= ?`;
        params.push(parseFloat(temp_min));
    }
    if (temp_max) {
        query += ` AND temperature <= ?`;
        params.push(parseFloat(temp_max));
    }
    if (date_from) {
        query += ` AND timestamp >= ?`;
        params.push(date_from);
        console.log(date_from);
    }
    if (date_to) {
        query += ` AND timestamp <= ?`;
        params.push(date_to);
        console.log(date_to);
    }

    query += ` ORDER BY timestamp DESC`;

    const rowLimit = limit ? parseInt(limit, 10) : 100;
    query += ` LIMIT ?`;
    params.push(rowLimit);

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database execution failed' });
        }
        res.json(rows);
    });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server bezi a nasloucha na portu ${PORT}`);
});