-- 購読者テーブル
-- 個人情報保護法・特定電子メール法への対応として、
-- 同意の日時とその取得元（IP / User-Agent）を記録する。
CREATE TABLE IF NOT EXISTS subscribers (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  email                 TEXT NOT NULL UNIQUE,
  -- pending: 確認メール送信済み / confirmed: 購読中 / unsubscribed: 配信停止済み
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'confirmed', 'unsubscribed')),
  -- 確認トークンは平文で保存せず SHA-256 ハッシュのみ保持する
  confirm_token_hash    TEXT,
  confirm_expires_at    TEXT,
  requested_at          TEXT NOT NULL,
  confirmed_at          TEXT,
  unsubscribed_at       TEXT,
  -- 同意の記録（特定電子メール法 第4条／保存期間3年）
  consent_ip            TEXT,
  consent_user_agent    TEXT,
  source                TEXT,
  bounce_count          INTEGER NOT NULL DEFAULT 0,
  last_sent_at          TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers (status);
CREATE INDEX IF NOT EXISTS idx_subscribers_confirm_hash ON subscribers (confirm_token_hash);

-- 配信履歴（同じ号の二重送信を防ぐため slug を一意にする）
CREATE TABLE IF NOT EXISTS newsletter_issues (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  slug           TEXT NOT NULL UNIQUE,
  subject        TEXT NOT NULL,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  failed_count   INTEGER NOT NULL DEFAULT 0,
  sent_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 監査ログ（同意・配信停止の証跡）
CREATE TABLE IF NOT EXISTS consent_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL,
  -- requested / confirmed / unsubscribed / deleted
  event         TEXT NOT NULL,
  ip            TEXT,
  user_agent    TEXT,
  occurred_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_consent_log_email ON consent_log (email);
