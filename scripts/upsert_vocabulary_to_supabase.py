from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path


DEFAULT_TIMEOUT = 20
DEFAULT_CHUNK_SIZE = 50


def parse_args() -> argparse.Namespace:
    project_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(
        description='调用 Supabase RPC 批量新增或更新词库数据。'
    )
    parser.add_argument(
        '--input',
        default=str(project_root / 'src' / 'data' / 'vocabulary.json'),
        help='词库 JSON 路径，默认使用 src/data/vocabulary.json',
    )
    parser.add_argument(
        '--env-file',
        default=str(project_root / '.env.local'),
        help='环境变量文件路径，默认使用 .env.local',
    )
    parser.add_argument(
        '--project-url',
        default='',
        help='Supabase Project URL，未传时会尝试从环境变量读取',
    )
    parser.add_argument(
        '--service-role-key',
        default='',
        help='Supabase service role key，未传时会尝试从环境变量读取',
    )
    parser.add_argument(
        '--chunk-size',
        type=int,
        default=DEFAULT_CHUNK_SIZE,
        help=f'每次 RPC 提交多少条，默认 {DEFAULT_CHUNK_SIZE}',
    )
    parser.add_argument(
        '--timeout',
        type=int,
        default=DEFAULT_TIMEOUT,
        help=f'单次请求超时时间（秒），默认 {DEFAULT_TIMEOUT}',
    )
    parser.add_argument(
        '--limit',
        type=int,
        default=0,
        help='仅处理前 N 条，0 表示全部处理',
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='只检查配置和输入，不真正发起请求',
    )
    return parser.parse_args()


def load_env_file(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}

    env: dict[str, str] = {}
    for raw_line in path.read_text(encoding='utf-8').splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue

        key, value = line.split('=', 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        env[key] = value
    return env


def resolve_config(args: argparse.Namespace) -> tuple[str, str]:
    env_file_values = load_env_file(Path(args.env_file).resolve())
    project_url = (
        args.project_url.strip()
        or os.environ.get('VITE_SUPABASE_URL', '').strip()
        or env_file_values.get('VITE_SUPABASE_URL', '').strip()
    )
    service_role_key = (
        args.service_role_key.strip()
        or os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '').strip()
        or env_file_values.get('SUPABASE_SERVICE_ROLE_KEY', '').strip()
    )
    return project_url.rstrip('/'), service_role_key


def load_entries(path: Path) -> list[dict]:
    payload = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(payload, list):
        raise ValueError('词库 JSON 须为数组。')

    entries: list[dict] = []
    for index, item in enumerate(payload, start=1):
        if not isinstance(item, dict):
            raise ValueError(f'第 {index} 条不是对象。')
        word = str(item.get('word', '')).strip()
        if not word:
            raise ValueError(f'第 {index} 条缺少 word。')
        entries.append(item)
    return entries


def chunked(items: list[dict], size: int) -> list[list[dict]]:
    if size <= 0:
        raise ValueError('chunk-size 必须大于 0。')
    return [items[index : index + size] for index in range(0, len(items), size)]


def call_rpc(project_url: str, service_role_key: str, entries: list[dict], timeout: int) -> list[dict]:
    endpoint = f'{project_url}/rest/v1/rpc/upsert_vocabulary_entries'
    body = json.dumps({'entries': entries}, ensure_ascii=False).encode('utf-8')
    request = urllib.request.Request(
        endpoint,
        data=body,
        method='POST',
        headers={
            'Content-Type': 'application/json',
            'apikey': service_role_key,
            'Authorization': f'Bearer {service_role_key}',
            'Prefer': 'return=representation',
        },
    )

    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode('utf-8'))


def main() -> int:
    args = parse_args()
    input_path = Path(args.input).resolve()
    env_path = Path(args.env_file).resolve()

    if not input_path.exists():
        raise FileNotFoundError(f'词库文件不存在: {input_path}')

    project_url, service_role_key = resolve_config(args)

    entries = load_entries(input_path)
    if args.limit > 0:
        entries = entries[:args.limit]

    print(f'词库文件: {input_path}')
    print(f'环境文件: {env_path}')
    print(f'目标项目: {project_url or "(missing)"}')
    print(f'待处理条数: {len(entries)}')
    print(f'分块大小: {args.chunk_size}')

    if args.dry_run:
        if not project_url:
            print('提示：当前未检测到 VITE_SUPABASE_URL。', file=sys.stderr)
        if not service_role_key:
            print('提示：当前未检测到 SUPABASE_SERVICE_ROLE_KEY。', file=sys.stderr)
        print('dry-run 已开启，未发起写入请求。')
        return 0

    if not project_url:
        print('缺少 Supabase Project URL。请传 --project-url，或在 .env.local 中设置 VITE_SUPABASE_URL。', file=sys.stderr)
        return 1

    if not service_role_key:
        print(
            '缺少 SUPABASE_SERVICE_ROLE_KEY。请传 --service-role-key，或在 .env.local 中设置 SUPABASE_SERVICE_ROLE_KEY。',
            file=sys.stderr,
        )
        print('注意：这个 key 不要加 VITE_ 前缀，也不要放进前端代码。', file=sys.stderr)
        return 1

    total_written = 0
    batches = chunked(entries, args.chunk_size)

    for index, batch in enumerate(batches, start=1):
        print(f'[{index}/{len(batches)}] 正在写入 {len(batch)} 条...')
        rows = call_rpc(project_url, service_role_key, batch, args.timeout)
        total_written += len(rows)

    print()
    print(f'写入完成，总计返回 {total_written} 条记录。')
    print('如果你刚执行完 SQL 仍然报 RPC 不存在，请先去 Supabase SQL Editor 执行 supabase/vocabulary_admin_api.sql。')
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except urllib.error.HTTPError as error:
        details = error.read().decode('utf-8', errors='replace')
        print(f'HTTP {error.code}: {details}', file=sys.stderr)
        raise SystemExit(1)
    except urllib.error.URLError as error:
        print(f'网络错误: {error.reason}', file=sys.stderr)
        raise SystemExit(1)
    except Exception as error:  # noqa: BLE001
        print(f'执行失败: {error}', file=sys.stderr)
        raise SystemExit(1)
