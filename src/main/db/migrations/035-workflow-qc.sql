-- Workflow QC audit trail — owner-facing record of all QC runs per workflow
-- Buyer-facing certificate is stored as qc-certificate.json on the Hetzner workflow volume
-- Dual storage: this table (owner audit) + Hetzner volume JSON (buyer-facing badge)

CREATE TABLE IF NOT EXISTS workflow_qc_runs (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id         TEXT NOT NULL,
  workflow_name       TEXT NOT NULL,
  workflow_version    TEXT NOT NULL,
  qc_mode             TEXT NOT NULL,               -- 'lightweight' | 'full'
  gate_1_result       TEXT,                        -- JSON: scope classification result
  gate_2_result       TEXT,                        -- JSON: structure validation result
  gate_3_result       TEXT,                        -- JSON: forbidden content scan result
  gate_4_result       TEXT,                        -- JSON: injection resistance result (NULL in lightweight)
  gate_5_result       TEXT,                        -- JSON: LLM compatibility result
  gate_6_result       TEXT,                        -- JSON: output quality result (NULL in lightweight)
  gate_7_result       TEXT,                        -- JSON: certification summary
  distribution_ready  INTEGER NOT NULL DEFAULT 0,  -- 1 = certified YES, 0 = not certified
  min_llm_tier        INTEGER,                     -- 1-5 from gate 5 static assessment
  run_by              TEXT,                        -- model name used to run this QC session
  notes               TEXT,                        -- warnings, partial results, human comments
  run_at              DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wqc_workflow_id ON workflow_qc_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_wqc_run_at ON workflow_qc_runs(run_at DESC);
CREATE INDEX IF NOT EXISTS idx_wqc_ready ON workflow_qc_runs(distribution_ready, run_at DESC);
