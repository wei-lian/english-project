from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path


API_TEMPLATE = 'https://api.dictionaryapi.dev/api/v2/entries/en/{word}'
DEFAULT_TIMEOUT = 8


@dataclass
class SeedWord:
    word: str
    category: str = 'basic'
    difficulty: str = 'medium'
    full_form: str = ''
    zh: str = ''
    description: str = ''


def parse_args() -> argparse.Namespace:
    project_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(
        description='批量抓取编程词汇的音标、释义和例句，并生成前端词库 JSON。'
    )
    parser.add_argument(
        '--input',
        default=str(Path(__file__).with_name('code_vocab_seed.txt')),
        help='词单文件路径，默认使用 scripts/code_vocab_seed.txt',
    )
    parser.add_argument(
        '--output',
        default=str(project_root / 'src' / 'data' / 'vocabulary.generated.json'),
        help='输出 JSON 路径，默认写入 src/data/vocabulary.generated.json',
    )
    parser.add_argument(
        '--failures',
        default=str(Path(__file__).with_name('fetch_failures.json')),
        help='失败记录输出路径',
    )
    parser.add_argument(
        '--delay',
        type=float,
        default=0.15,
        help='每次请求之间的等待秒数，默认 0.15',
    )
    parser.add_argument(
        '--limit',
        type=int,
        default=0,
        help='仅处理前 N 个词，0 表示全部处理',
    )
    parser.add_argument(
        '--timeout',
        type=float,
        default=8,
        help='单次词典请求超时时间（秒），默认 8',
    )
    parser.add_argument(
        '--save-every',
        type=int,
        default=10,
        help='每处理多少个词就保存一次进度，默认 10',
    )
    parser.add_argument(
        '--skip-existing',
        action='store_true',
        help='若输出文件里已有同名单词，则直接复用并跳过抓取',
    )
    return parser.parse_args()


def read_seed_file(path: Path) -> list[SeedWord]:
    if not path.exists():
        raise FileNotFoundError(f'词单文件不存在: {path}')

    words: list[SeedWord] = []
    for line_number, raw_line in enumerate(path.read_text(encoding='utf-8').splitlines(), start=1):
        line = raw_line.strip()
        if not line or line.startswith('#'):
            continue

        parts = [part.strip() for part in line.split('|')]
        parts.extend([''] * (6 - len(parts)))
        word, category, difficulty, full_form, zh, description = parts[:6]

        if not word:
            print(f'[WARN] 第 {line_number} 行缺少单词，已跳过。', file=sys.stderr)
            continue

        words.append(
            SeedWord(
                word=word,
                category=category or 'basic',
                difficulty=difficulty or 'medium',
                full_form=full_form or word,
                zh=zh,
                description=description,
            )
        )

    return words


def load_existing_entries(path: Path) -> dict[str, dict]:
    if not path.exists():
        return {}

    try:
        payload = json.loads(path.read_text(encoding='utf-8'))
    except json.JSONDecodeError:
        print(f'[WARN] 现有词库 JSON 无法解析，忽略旧数据: {path}', file=sys.stderr)
        return {}

    if not isinstance(payload, list):
        return {}

    return {item.get('word'): item for item in payload if isinstance(item, dict) and item.get('word')}


def request_json(url: str, timeout: float) -> list[dict]:
    request = urllib.request.Request(
        url,
        headers={
            'User-Agent': 'CodeVocabVocabularyFetcher/1.0'
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode('utf-8'))


def fetch_dictionary_payload(query: str, timeout: float) -> tuple[list[dict] | None, str | None]:
    url = API_TEMPLATE.format(word=urllib.parse.quote(query))
    try:
        return request_json(url, timeout), None
    except urllib.error.HTTPError as error:
        return None, f'HTTP {error.code}'
    except urllib.error.URLError as error:
        return None, f'网络错误: {error.reason}'
    except TimeoutError:
        return None, '请求超时'
    except json.JSONDecodeError:
        return None, '响应 JSON 解析失败'


def pick_phonetic(entry: dict) -> str:
    if entry.get('phonetic'):
        return entry['phonetic']

    for item in entry.get('phonetics', []):
        if item.get('text'):
            return item['text']
    return ''


def pick_audio(entry: dict) -> str:
    for item in entry.get('phonetics', []):
        if item.get('audio'):
            return item['audio']
    return ''


def shrink_meanings(entry: dict) -> list[dict]:
    reduced: list[dict] = []
    for meaning in entry.get('meanings', [])[:3]:
        definitions = []
        for definition in meaning.get('definitions', [])[:3]:
            definitions.append(
                {
                    'definition': definition.get('definition', ''),
                    'example': definition.get('example', ''),
                }
            )

        reduced.append(
            {
                'partOfSpeech': meaning.get('partOfSpeech', ''),
                'definitions': definitions,
            }
        )
    return reduced


def first_definition(meanings: list[dict]) -> tuple[str, str, str]:
    if not meanings:
        return '', '', ''

    first_meaning = meanings[0]
    first_item = (first_meaning.get('definitions') or [{}])[0]
    return (
        first_meaning.get('partOfSpeech', ''),
        first_item.get('definition', ''),
        first_item.get('example', ''),
    )


def fetch_word(seed: SeedWord, timeout: float) -> tuple[dict | None, str | None]:
    attempts = []
    for query in dict.fromkeys([seed.full_form, seed.word]):
        if not query:
            continue
        payload, error = fetch_dictionary_payload(query, timeout)
        if payload:
            return payload[0], None
        attempts.append(f'{query}: {error}')
    return None, '; '.join(attempts) if attempts else '没有可用查询词'


def save_progress(output_path: Path, failures_path: Path, entries: list[dict], failures: list[dict]) -> None:
    output_path.write_text(
        json.dumps(entries, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )
    failures_path.write_text(
        json.dumps(failures, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )


def build_entry(seed: SeedWord, fetched: dict | None, existing: dict | None) -> dict:
    existing = existing or {}
    meanings = shrink_meanings(fetched or {})
    part_of_speech, english_definition, example = first_definition(meanings)
    zh_meaning = seed.zh or existing.get('translations', {}).get('zh', '')
    description = seed.description or english_definition or existing.get('description', '')

    return {
        'word': seed.word,
        'fullForm': seed.full_form or existing.get('fullForm') or seed.word,
        'category': seed.category or existing.get('category') or 'basic',
        'difficulty': seed.difficulty or existing.get('difficulty') or 'medium',
        'partOfSpeech': part_of_speech or existing.get('partOfSpeech', ''),
        'phonetic': pick_phonetic(fetched or {}) or existing.get('phonetic', ''),
        'audio': pick_audio(fetched or {}) or existing.get('audio', ''),
        'translations': {
            'zh': zh_meaning
        },
        'description': description,
        'englishDefinition': english_definition or existing.get('englishDefinition', ''),
        'example': example or existing.get('example', ''),
        'meanings': meanings or existing.get('meanings', []),
        'codeExamples': existing.get('codeExamples', []),
    }


def main() -> int:
    args = parse_args()
    input_path = Path(args.input).resolve()
    output_path = Path(args.output).resolve()
    failures_path = Path(args.failures).resolve()

    seed_words = read_seed_file(input_path)
    if args.limit > 0:
        seed_words = seed_words[:args.limit]

    existing_entries = load_existing_entries(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    failures_path.parent.mkdir(parents=True, exist_ok=True)

    generated_entries: list[dict] = []
    failures: list[dict] = []

    for index, seed in enumerate(seed_words, start=1):
        existing_entry = existing_entries.get(seed.word)
        if args.skip_existing and existing_entry:
            print(f'[{index}/{len(seed_words)}] Skipping {seed.word} (already exists)')
            generated_entries.append(existing_entry)
            if args.save_every > 0 and index % args.save_every == 0:
                save_progress(output_path, failures_path, generated_entries, failures)
            continue

        print(f'[{index}/{len(seed_words)}] Fetching {seed.word} ...')
        fetched, error = fetch_word(seed, args.timeout)
        if error:
            failures.append(
                {
                    'word': seed.word,
                    'error': error,
                }
            )

        entry = build_entry(seed, fetched, existing_entries.get(seed.word))
        generated_entries.append(entry)
        if args.save_every > 0 and index % args.save_every == 0:
            save_progress(output_path, failures_path, generated_entries, failures)
        time.sleep(max(args.delay, 0))

    save_progress(output_path, failures_path, generated_entries, failures)

    print()
    print(f'已生成词条: {len(generated_entries)}')
    print(f'失败条数: {len(failures)}')
    print(f'词库输出: {output_path}')
    print(f'失败记录: {failures_path}')
    print()
    print('如果你需要更好的中文释义，可以在词单文件里补第 5 列 zh，再重新执行脚本。')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
