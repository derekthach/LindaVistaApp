import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { ROOM_OPTIONS } from '@/lib/checkins/rooms';

let db: Database.Database | null = null;

function getDbPath() {
  if (process.env.SQLITE_PATH) {
    return process.env.SQLITE_PATH;
  }
  if (process.env.VERCEL) {
    return '/tmp/motel.db';
  }
  return path.join(process.cwd(), 'data', 'motel.db');
}

function ensureDbDirectory(dbPath: string) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getDb() {
  if (!db) {
    const dbPath = getDbPath();
    ensureDbDirectory(dbPath);
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

export function initDbIfMissing() {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS Rooms (
      room_id TEXT PRIMARY KEY,
      status TEXT NOT NULL
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS CheckIns (
      checkin_id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_number TEXT,
      date TEXT,
      time TEXT,
      room_id TEXT,
      cost REAL,
      payment_method TEXT,
      staff_name TEXT,
      car_plate TEXT,
      car_make TEXT,
      car_color TEXT,
      note TEXT,
      FOREIGN KEY(room_id) REFERENCES Rooms(room_id)
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS Settings (
      setting_name TEXT PRIMARY KEY,
      setting_value TEXT
    )
  `);

  const roomCount = database
    .prepare('SELECT COUNT(*) as count FROM Rooms')
    .get() as { count: number };

  if (roomCount.count === 0) {
    const insertRoom = database.prepare(
      'INSERT INTO Rooms (room_id, status) VALUES (?, ?)'
    );
    const transaction = database.transaction(() => {
      for (const id of ROOM_OPTIONS) {
        insertRoom.run(String(id), 'Available');
      }
    });
    transaction();
  }

  const receiptSetting = database
    .prepare('SELECT setting_value FROM Settings WHERE setting_name = ?')
    .get('next_receipt_number') as { setting_value: string } | undefined;

  if (!receiptSetting) {
    database
      .prepare(
        'INSERT INTO Settings (setting_name, setting_value) VALUES (?, ?)'
      )
      .run('next_receipt_number', '00001');
  }
}
