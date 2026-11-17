-- Database BARU khusus J-DATA Report (jdata_sync_db). Tidak menyentuh database POS maupun jdata_db.
CREATE TABLE IF NOT EXISTS sales(
  profile TEXT NOT NULL, tanggal TEXT NOT NULL, outlet_key TEXT NOT NULL, outlet_id TEXT, outlet_name TEXT,
  salesman TEXT, sku_code TEXT NOT NULL DEFAULT '', sku_name TEXT NOT NULL DEFAULT '',
  omset REAL DEFAULT 0, qty_karton REAL DEFAULT 0, ordered INTEGER DEFAULT 0, visited INTEGER DEFAULT 0,
  faktur TEXT NOT NULL DEFAULT '', channel TEXT DEFAULT '', updated INTEGER
);
CREATE INDEX IF NOT EXISTS i_sales_pt ON sales(profile, tanggal);
CREATE INDEX IF NOT EXISTS i_sales_pf ON sales(profile, faktur, sku_code, sku_name);

CREATE TABLE IF NOT EXISTS ro(
  profile TEXT NOT NULL, outlet_key TEXT NOT NULL, outlet_id TEXT, outlet_name TEXT, salesman TEXT, channel TEXT,
  cluster TEXT, kecamatan TEXT, kabupaten TEXT, extra TEXT, updated INTEGER,
  PRIMARY KEY(profile, outlet_key)
);

CREATE TABLE IF NOT EXISTS targets(
  profile TEXT NOT NULL, salesman TEXT NOT NULL, omset REAL DEFAULT 0, ao REAL DEFAULT 0, qty REAL DEFAULT 0, updated INTEGER,
  PRIMARY KEY(profile, salesman)
);

-- Ringkasan harian per outlet (dipakai nanti untuk prediksi/analisa cepat tanpa baca semua baris).
CREATE TABLE IF NOT EXISTS daily_outlet(
  profile TEXT NOT NULL, tanggal TEXT NOT NULL, outlet_key TEXT NOT NULL, salesman TEXT,
  omset REAL DEFAULT 0, qty_karton REAL DEFAULT 0, sku_count INTEGER DEFAULT 0,
  PRIMARY KEY(profile, tanggal, outlet_key)
);

CREATE TABLE IF NOT EXISTS programs(
  profile TEXT NOT NULL, id TEXT NOT NULL, name TEXT, type TEXT, from_d TEXT, to_d TEXT, sku TEXT, outlets INTEGER DEFAULT 0,
  target REAL DEFAULT 0, actual REAL DEFAULT 0, achieved INTEGER DEFAULT 0, def TEXT, daily TEXT, updated INTEGER,
  PRIMARY KEY(profile, id)
);
