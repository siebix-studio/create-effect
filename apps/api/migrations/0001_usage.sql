-- Every event as received. Only kept so `tallies` can be rebuilt.
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  received_at INTEGER NOT NULL,
  body TEXT NOT NULL
);

-- One counter per answer, updated as events arrive.
CREATE TABLE tallies (
  dimension TEXT NOT NULL,
  value TEXT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (dimension, value)
) WITHOUT ROWID;
