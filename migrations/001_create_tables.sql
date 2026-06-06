-- スタッフマスタ
CREATE TABLE staff_master (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT
);

-- プロジェクトマスタ
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  start_date DATE,
  end_date DATE,
  manager_id TEXT REFERENCES staff_master(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 安全点検マスタ
CREATE TABLE inspection_master (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- コメントマスタ
CREATE TABLE comments_master (
  id TEXT PRIMARY KEY,
  category TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 安全点検（メイン）
CREATE TABLE inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id TEXT NOT NULL UNIQUE,
  project_id TEXT REFERENCES projects(id),
  inspector_id TEXT REFERENCES staff_master(id),
  inspection_date DATE NOT NULL,
  categories TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  comments TEXT,
  report_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 安全点検詳細
CREATE TABLE inspection_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  item_id TEXT REFERENCES inspection_master(id),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  result TEXT NOT NULL, -- '合' or '不合'
  issue_content TEXT,
  issue_image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_inspections_project_id ON inspections(project_id);
CREATE INDEX idx_inspections_inspector_id ON inspections(inspector_id);
CREATE INDEX idx_inspections_inspection_date ON inspections(inspection_date);
CREATE INDEX idx_inspection_details_inspection_id ON inspection_details(inspection_id);
