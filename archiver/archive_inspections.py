# -*- coding: utf-8 -*-
"""
安全パトロール 点検データ アーカイバ
---------------------------------------------------------------
目的: クラウド(Supabase)のストレージ容量を節約するため、一定期間より
      古い点検の「写真・PDF」を共有ドライブ(G:)へ移動し、クラウドから削除する。
      点検記録（DBの行）はアプリに残す（検索・閲覧可能なまま）。

方針（ユーザー確定 2026-06-08）:
  - 経過期間で自動: 点検日が RETENTION_MONTHS（既定6ヶ月）より古いものが対象
  - 削除範囲: 重い写真・PDF のみ削除。点検記録は残す
  - アプリ越しのみ参照の原則は維持（クラウドからファイルは消える）

安全設計:
  - 「ローカル(G:)へコピー＆サイズ検証が成功した後でのみ」クラウドを削除する
  - 既にアーカイブ済み(report_url が 'archived:' で始まる)はスキップ（冪等）
  - --dry-run で削除せず動作確認
  - 1点検ごとに try/except。失敗した点検は一切削除しない

実行例:
  python archive_inspections.py            # 本番（6ヶ月より古いものを処理）
  python archive_inspections.py --dry-run  # 確認のみ（コピー/削除しない）
  python archive_inspections.py --months 3 # 期間を一時的に変更
"""
import argparse
import csv
import datetime as dt
import json
import os
import re
import sys

import requests

# Windowsコンソール(cp932)で日本語/絵文字のprintが落ちないようUTF-8化
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# ====================== 設定 ======================
SUPABASE_URL = "https://kdobarabbebkithfjrkd.supabase.co"  # 機密ではない
RETENTION_MONTHS = 6  # これより古い点検を対象（ユーザー確定: 6ヶ月）

PHOTOS_BUCKET = "inspection-photos"   # 公開バケット（写真）
REPORTS_BUCKET = "inspection-reports" # 非公開バケット（PDF）

ARCHIVE_BASE = r"G:\共有ドライブ\社内システム\01.アプリ\01.安全点検\アーカイブ"
LEDGER_CSV = os.path.join(ARCHIVE_BASE, "_アーカイブ台帳.csv")

# サービスロールキーはリポジトリ外のファイルから読む（誤コミット防止）
KEY_DIR = r"C:\ProgramData\SafetyPatrolArchiver"
KEY_FILE = os.path.join(KEY_DIR, "service_role_key.txt")
LOG_DIR = os.path.join(KEY_DIR, "logs")
# ==================================================

JST = dt.timezone(dt.timedelta(hours=9))


def log(msg):
    line = f"[{dt.datetime.now(JST):%Y-%m-%d %H:%M:%S}] {msg}"
    print(line)
    try:
        os.makedirs(LOG_DIR, exist_ok=True)
        with open(os.path.join(LOG_DIR, f"archive_{dt.date.today():%Y-%m}.log"), "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass


def load_key():
    if not os.path.exists(KEY_FILE):
        log(f"❌ サービスロールキーが見つかりません: {KEY_FILE}")
        log("   Supabase の service_role キー（sb_secret_... または JWT）を上記ファイルに保存してください。")
        sys.exit(2)
    with open(KEY_FILE, encoding="utf-8") as f:
        key = f.read().strip()
    if not key:
        log(f"❌ キーファイルが空です: {KEY_FILE}")
        sys.exit(2)
    return key


def months_ago(d: dt.date, n: int) -> dt.date:
    """d から n ヶ月前の日付を返す（月末は丸め）。"""
    m = d.month - 1 - n
    y = d.year + m // 12
    m = m % 12 + 1
    day = min(d.day, [31, 29 if y % 4 == 0 and (y % 100 != 0 or y % 400 == 0) else 28,
                      31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1])
    return dt.date(y, m, day)


def sanitize(s: str) -> str:
    s = re.sub(r'[\\/:*?"<>|]', "_", str(s or "")).strip()
    return s[:80] or "unknown"


def rest_headers(key, json_body=False):
    h = {"apikey": key, "Authorization": f"Bearer {key}"}
    if json_body:
        h["Content-Type"] = "application/json"
    return h


def fetch_projects(key):
    r = requests.get(f"{SUPABASE_URL}/rest/v1/projects",
                     headers=rest_headers(key), params={"select": "id,name"}, timeout=60)
    r.raise_for_status()
    return {p["id"]: p.get("name") for p in r.json()}


def fetch_old_inspections(key, cutoff_iso):
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/inspections",
        headers=rest_headers(key),
        params={
            "select": "*,inspection_details(*)",
            "inspection_date": f"lt.{cutoff_iso}",
            "order": "inspection_date.asc",
        },
        timeout=120,
    )
    r.raise_for_status()
    return r.json()


def photo_path_from_url(url: str):
    """公開URLから inspection-photos バケット内パスを取り出す。"""
    marker = f"/{PHOTOS_BUCKET}/"
    if marker in url:
        return url.split(marker, 1)[1].split("?", 1)[0]
    return None


def download_public(url, dest):
    r = requests.get(url, timeout=120, stream=True)
    r.raise_for_status()
    with open(dest, "wb") as f:
        for chunk in r.iter_content(8192):
            f.write(chunk)
    return os.path.getsize(dest)


def download_private_object(key, bucket, path, dest):
    r = requests.get(f"{SUPABASE_URL}/storage/v1/object/{bucket}/{path}",
                     headers=rest_headers(key), timeout=120, stream=True)
    r.raise_for_status()
    with open(dest, "wb") as f:
        for chunk in r.iter_content(8192):
            f.write(chunk)
    return os.path.getsize(dest)


def delete_object(key, bucket, path):
    r = requests.delete(f"{SUPABASE_URL}/storage/v1/object/{bucket}/{path}",
                        headers=rest_headers(key), timeout=60)
    # 既に無い場合(404/400)は許容
    if r.status_code not in (200, 204, 404, 400):
        r.raise_for_status()


def collect_image_urls(detail):
    urls = []
    if isinstance(detail.get("issue_image_urls"), list):
        urls.extend([u for u in detail["issue_image_urls"] if u])
    if detail.get("issue_image_url"):
        urls.append(detail["issue_image_url"])
    return urls


def archive_one(key, insp, project_map, dry_run):
    insp_id = insp["id"]
    human_id = insp.get("inspection_id") or insp_id
    date_str = (insp.get("inspection_date") or "")[:10]
    year = date_str[:4] or "unknown"
    project_name = project_map.get(insp.get("project_id")) or insp.get("project_id") or "現場不明"

    folder_name = f"{date_str}_{sanitize(project_name)}_{sanitize(human_id)}"
    rel_path = os.path.join("アーカイブ", year, folder_name)
    dest_dir = os.path.join(ARCHIVE_BASE, year, folder_name)
    photos_dir = os.path.join(dest_dir, "写真")

    details = insp.get("inspection_details") or []

    # ---- ダウンロード対象を列挙 ----
    # 写真: 現場写真 + 各明細の指摘写真
    photo_jobs = []  # (公開URL, 保存先, バケット内パス)
    for i, url in enumerate(insp.get("site_photo_urls") or [], 1):
        p = photo_path_from_url(url)
        photo_jobs.append((url, os.path.join(photos_dir, f"現場写真_{i}{os.path.splitext(p or '')[1] or '.jpg'}"), p))
    for d in details:
        cat = sanitize(d.get("category") or "項目")
        for j, url in enumerate(collect_image_urls(d), 1):
            p = photo_path_from_url(url)
            photo_jobs.append((url, os.path.join(photos_dir, f"指摘_{cat}_{j}{os.path.splitext(p or '')[1] or '.jpg'}"), p))

    # PDF: report_url が 'reports/' で始まる場合のみ
    pdf_path = insp.get("report_url") if isinstance(insp.get("report_url"), str) else None
    has_pdf = bool(pdf_path and pdf_path.startswith("reports/"))

    if dry_run:
        log(f"  [DRY] {human_id} ({date_str} / {project_name}) -> {rel_path} : 写真{len(photo_jobs)}枚, PDF{'有' if has_pdf else '無'}")
        return ("dry", rel_path, len(photo_jobs), has_pdf)

    os.makedirs(photos_dir, exist_ok=True)

    delete_targets = []  # (bucket, path)

    # ---- 写真ダウンロード＆検証 ----
    for url, dest, bpath in photo_jobs:
        size = download_public(url, dest)
        if size <= 0:
            raise RuntimeError(f"写真のコピーに失敗(0byte): {url}")
        if bpath:
            delete_targets.append((PHOTOS_BUCKET, bpath))

    # ---- PDFダウンロード＆検証 ----
    if has_pdf:
        pdf_dest = os.path.join(dest_dir, "report.pdf")
        size = download_private_object(key, REPORTS_BUCKET, pdf_path, pdf_dest)
        if size <= 0:
            raise RuntimeError(f"PDFのコピーに失敗(0byte): {pdf_path}")
        delete_targets.append((REPORTS_BUCKET, pdf_path))

    # ---- 記録JSON（自己完結アーカイブ用。DBにも残る） ----
    with open(os.path.join(dest_dir, "record.json"), "w", encoding="utf-8") as f:
        json.dump(insp, f, ensure_ascii=False, indent=2)

    # ====== ここまで成功＝ローカルコピー完了。ここからクラウド削除 ======
    for bucket, path in delete_targets:
        delete_object(key, bucket, path)

    # DBを更新: report_url にアーカイブ位置を記録、画像URLを空に（壊れ画像防止）
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    requests.patch(
        f"{SUPABASE_URL}/rest/v1/inspections",
        headers={**rest_headers(key, json_body=True), "Prefer": "return=minimal"},
        params={"id": f"eq.{insp_id}"},
        data=json.dumps({"report_url": f"archived:{rel_path}", "site_photo_urls": [], "updated_at": now}),
        timeout=60,
    ).raise_for_status()
    if details:
        requests.patch(
            f"{SUPABASE_URL}/rest/v1/inspection_details",
            headers={**rest_headers(key, json_body=True), "Prefer": "return=minimal"},
            params={"inspection_id": f"eq.{insp_id}"},
            data=json.dumps({"issue_image_urls": [], "issue_image_url": None}),
            timeout=60,
        ).raise_for_status()

    log(f"  ✅ {human_id}: 写真{len(photo_jobs)}枚 + PDF{'1' if has_pdf else '0'} を {rel_path} へ移動しクラウド削除")
    return ("archived", rel_path, len(photo_jobs), has_pdf)


def append_ledger(rows):
    if not rows:
        return
    os.makedirs(ARCHIVE_BASE, exist_ok=True)
    new = not os.path.exists(LEDGER_CSV)
    with open(LEDGER_CSV, "a", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        if new:
            w.writerow(["アーカイブ日時", "点検ID", "点検日", "現場", "保存先", "写真枚数", "PDF"])
        for r in rows:
            w.writerow(r)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="削除せず対象を表示するだけ")
    ap.add_argument("--months", type=int, default=RETENTION_MONTHS, help="保持月数（既定6）")
    args = ap.parse_args()

    key = load_key()
    cutoff = months_ago(dt.date.today(), args.months)
    cutoff_iso = cutoff.isoformat()
    log(f"=== アーカイブ開始 (保持{args.months}ヶ月 / {cutoff_iso} より古い点検が対象){' [DRY-RUN]' if args.dry_run else ''} ===")

    try:
        project_map = fetch_projects(key)
        inspections = fetch_old_inspections(key, cutoff_iso)
    except requests.HTTPError as e:
        log(f"❌ Supabase 取得エラー: {e} / 本文: {getattr(e.response,'text','')[:300]}")
        sys.exit(1)

    # 既にアーカイブ済みは除外
    targets = [i for i in inspections
               if not (isinstance(i.get("report_url"), str) and i["report_url"].startswith("archived:"))]
    log(f"対象 {len(targets)} 件（取得 {len(inspections)} 件中、アーカイブ済み除く）")

    archived_rows = []
    ok = skip = fail = 0
    for insp in targets:
        try:
            status, rel, nph, has_pdf = archive_one(key, insp, project_map, args.dry_run)
            if status == "archived":
                ok += 1
                archived_rows.append([
                    f"{dt.datetime.now(JST):%Y-%m-%d %H:%M}",
                    insp.get("inspection_id") or insp["id"],
                    (insp.get("inspection_date") or "")[:10],
                    project_map.get(insp.get("project_id")) or insp.get("project_id") or "",
                    rel, nph, "有" if has_pdf else "無",
                ])
        except Exception as e:
            fail += 1
            log(f"  ⚠️ {insp.get('inspection_id') or insp['id']} の処理に失敗（このデータは削除しません）: {e}")

    if not args.dry_run:
        append_ledger(archived_rows)
    log(f"=== 完了: 成功 {ok} / 失敗 {fail} / 対象 {len(targets)} ===")


if __name__ == "__main__":
    main()
