/**
 * db.js — 比奇堡报价单 · SQLite 数据库模块
 * 功能：数据库初始化、建表、CRUD 操作
 * 使用：better-sqlite3（同步 API）
 */

const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'server', 'data', 'database.sqlite');
let _db = null;

/* ── 获取数据库连接（单例） ── */
function getDb() {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
  }
  return _db;
}

/* ── 初始化数据库，创建所有表 ── */
function init() {
  const db = getDb();

  // ① 物品数据表（原 Supabase game_items）
  db.exec(`
    CREATE TABLE IF NOT EXISTS game_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      objectId TEXT,
      objectName TEXT,
      primaryClass TEXT,
      secondClass TEXT,
      thirdClass TEXT,
      itemType TEXT,
      itemSubType TEXT,
      description TEXT,
      gridSize TEXT,
      basePrice REAL DEFAULT 0,
      avgPrice REAL DEFAULT 0,
      minPrice REAL DEFAULT 0,
      maxPrice REAL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // ② AW子弹订单表
  db.exec(`
    CREATE TABLE IF NOT EXISTS awm_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT,
      bullet_count INTEGER DEFAULT 0,
      total_price REAL DEFAULT 0,
      customer_type TEXT DEFAULT '打手上号',
      notes TEXT DEFAULT '',
      settled INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // ③ 赞赏记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS donations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nickname TEXT DEFAULT '匿名',
      amount REAL DEFAULT 0,
      message TEXT DEFAULT '',
      order_number TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // ④ 系统日志表
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag TEXT DEFAULT 'info',
      text TEXT DEFAULT '',
      time TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // ⑤ 物品价格表
  db.exec(`
    CREATE TABLE IF NOT EXISTS item_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER,
      price REAL DEFAULT 0,
      source TEXT DEFAULT 'manual',
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // ⑥ API 缓存表（用于存储从数据源获取的缓存数据）
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cache_key TEXT UNIQUE,
      data TEXT,
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // ⑦ 管理员配置表
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      config_key TEXT UNIQUE,
      config_value TEXT
    )
  `);

  // 创建索引
  db.exec(`CREATE INDEX IF NOT EXISTS idx_game_items_name ON game_items(objectName)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_game_items_class ON game_items(primaryClass)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_awm_orders_created ON awm_orders(created_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_donations_created ON donations(created_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_api_cache_key ON api_cache(cache_key)`);

  console.log('[DB] 数据库初始化完成');
}

/* ── 通用查询：获取单条记录 ── */
function get(table, conditions) {
  const db = getDb();
  const keys = Object.keys(conditions);
  const values = Object.values(conditions);
  const where = keys.map(k => `${k} = ?`).join(' AND ');
  const row = db.prepare(`SELECT * FROM ${table} WHERE ${where} LIMIT 1`).get(...values);
  return row || null;
}

/* ── 通用查询：查找记录（返回第一条） ── */
function find(table, conditions) {
  const db = getDb();
  const keys = Object.keys(conditions);
  const values = Object.values(conditions);
  const where = keys.map(k => `${k} = ?`).join(' AND ');
  const row = db.prepare(`SELECT * FROM ${table} WHERE ${where} LIMIT 1`).get(...values);
  return row || null;
}

/* ── 通用查询：获取全部记录 ── */
function getAll(table, opts = {}) {
  const db = getDb();
  let sql = `SELECT * FROM ${table}`;
  const params = [];

  if (opts.where) {
    const keys = Object.keys(opts.where);
    const values = Object.values(opts.where);
    sql += ' WHERE ' + keys.map(k => `${k} = ?`).join(' AND ');
    params.push(...values);
  }

  if (opts.orderBy) {
    sql += ` ORDER BY ${opts.orderBy} ${opts.orderDir === 'asc' ? 'ASC' : 'DESC'}`;
  }

  if (opts.limit) {
    sql += ` LIMIT ?`;
    params.push(opts.limit);
  }

  const rows = db.prepare(sql).all(...params);
  return rows || [];
}

/* ── 通用插入 ── */
function insert(table, data) {
  const db = getDb();
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map(() => '?').join(', ');
  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
  const result = db.prepare(sql).run(...values);
  return { id: result.lastInsertRowid, ...data };
}

/* ── 通用更新 ── */
function update(table, id, data) {
  const db = getDb();
  const keys = Object.keys(data);
  const values = Object.values(data);
  const setClause = keys.map(k => `${k} = ?`).join(', ');
  const sql = `UPDATE ${table} SET ${setClause} WHERE id = ?`;
  db.prepare(sql).run(...values, id);
  return true;
}

/* ── 通用删除 ── */
function del(table, conditions) {
  const db = getDb();
  const keys = Object.keys(conditions);
  const values = Object.values(conditions);
  const where = keys.map(k => `${k} = ?`).join(' AND ');
  const sql = `DELETE FROM ${table} WHERE ${where}`;
  db.prepare(sql).run(...values);
  return true;
}

/* ── 清空表 ── */
function deleteAll(table) {
  const db = getDb();
  db.prepare(`DELETE FROM ${table}`).run();
  return true;
}

/* ── 关闭数据库 ── */
function close() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

module.exports = {
  init,
  get,
  find,
  getAll,
  insert,
  update,
  delete: del,
  deleteAll,
  close,
};