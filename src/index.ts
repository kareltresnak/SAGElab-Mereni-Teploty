import express, { Request, Response } from 'express';
import sqlite3 from 'sqlite3';
import cors from 'cors';

const PORT: number =  8132;
const DB_PATH: string = 'databaze.sqlite';

const app = express();
app.use(cors());
app.use(express.json());

const sqlite = sqlite3.verbose();

const db = new sqlite.Database(DB_PATH, (err: Error | null) => {
  if (err) {
    console.error("Kritická chyba databáze:", err.message);
  } else {
    console.log('Připojeno k SQLite databázi.');
    vytvorTabulky();
  }
});

function vytvorTabulky(): void {
  db.run(`CREATE TABLE IF NOT EXISTS mereni (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER NOT NULL,
    device_name TEXT,
    temperature REAL NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS prikazy (
    device_id INTEGER PRIMARY KEY,
    prikaz_blink INTEGER DEFAULT 0
  )`);
}

// --- Typová rozhraní pro kontrakty API ---

interface DataPostRequest {
  device_id: number;
  device_name?: string;
  temperature: number;
}

interface CommandBlinkRequest {
  device_id: number;
}

interface FilterQuery {
  device_id?: string;
  device_name?: string;
  temp_min?: string;
  temp_max?: string;
  date_from?: string;
  date_to?: string;
  limit?: string;
}

// --- Endpointy ---

app.get('/data', (_req: Request, res: Response) => {
  db.all('SELECT * FROM mereni ORDER BY timestamp DESC LIMIT 100', [], (err: Error | null, rows: any[]) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/command/blink', (req: Request<{}, {}, CommandBlinkRequest>, res: Response) => {
  const { device_id } = req.body;

  if (device_id === undefined) {
    return res.status(400).json({ error: "Chybi 'device_id'." });
  }

  console.log(`Požadavek na bliknutí pro zařízení ID: ${device_id}`);

  const sql = 'INSERT OR REPLACE INTO prikazy (device_id, prikaz_blink) VALUES (?, 1)';
  db.run(sql, [device_id], function (err: Error | null) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: `Prikaz pro ID ${device_id} zarazen do fronty.` });
  });
});

app.post('/data', (req: Request<{}, {}, DataPostRequest>, res: Response) => {
  const { device_id, device_name, temperature } = req.body;

  if (temperature === undefined || device_id === undefined) {
    return res.status(400).json({ error: "Chybí povinná data (device_id, temperature)." });
  }

  const sqlInsert = 'INSERT INTO mereni (device_id, device_name, temperature) VALUES (?, ?, ?)';
  db.run(sqlInsert, [device_id, device_name || 'Nezname', temperature], function (err: Error | null) {
    if (err) return res.status(500).json({ error: err.message });

    console.log(`Uloženo [${device_id} - ${device_name || 'Nezname'}] - Teplota: ${temperature}°C.`);

    const sqlCheck = 'SELECT prikaz_blink FROM prikazy WHERE device_id = ?';
    db.get(sqlCheck, [device_id], (err: Error | null, row: { prikaz_blink: number } | undefined) => {
      let ma_bliknout = false;

      if (err) {
        console.error("Chyba při kontrole příkazů:", err.message);
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

app.get('/data/filter', (req: Request<{}, {}, {}, FilterQuery>, res: Response) => {
  const { device_id, device_name, temp_min, temp_max, date_from, date_to, limit } = req.query;

  let query = `SELECT id, device_id, device_name, temperature, timestamp FROM mereni WHERE 1=1`;
  let params: any[] = [];

  if (device_id) {
    query += ` AND device_id = ?`;
    params.push(Number(device_id));
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
  }
  if (date_to) {
    query += ` AND timestamp <= ?`;
    params.push(date_to);
  }

  query += ` ORDER BY timestamp DESC`;

  const rowLimit = limit ? parseInt(limit, 10) : 100;
  query += ` LIMIT ?`;
  params.push(rowLimit);

  db.all(query, params, (err: Error | null, rows: any[]) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Selhani exekuce databazového dotazu.' });
    }
    res.json(rows);
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server akceptuje spojení na portu ${PORT}`);
});