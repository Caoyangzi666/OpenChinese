"""Rebuild offline readings and segmentation frequencies without discarding senses.

Inputs: a CC-CEDICT StarDict basename and Jieba's MIT-licensed dict.txt.
Run: python tools/prepare_reading_data.py --stardict PATH --frequencies PATH
The original HSK files are unchanged. No download occurs in this script.
"""
import argparse
import hashlib
import json
import re
import struct
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--stardict', type=Path, required=True)
parser.add_argument('--frequencies', type=Path, required=True)
parser.add_argument('--readings', type=Path, required=True, help='MIT-licensed pypinyin pinyin_dict.json')
args = parser.parse_args()
preferred_readings = json.loads(args.readings.read_text(encoding='utf8'))
data = ROOT / 'app/src/main/assets/data'
idx = args.stardict.with_suffix('.idx').read_bytes()
definitions = args.stardict.with_suffix('.dict').read_bytes()
dictionary = {}
pos = 0

def field(text, label):
    match = re.search('^' + label + r':\s*([^\r\n]+)', text, re.M)
    return match.group(1).strip() if match else ''

def preference(sense):
    # Prefer ordinary lexical senses over a surname, abbreviation, rare variant
    # or a pronunciation restricted to another expression. Preserve ALL senses.
    pinyin, meaning = sense
    score = 0
    if pinyin[:1].isupper(): score -= 8
    if re.search(r'^(surname|abbr\.|(?:euphemistic |unofficial |old )?variant of|used in|see |\(old\)|\(archaic\))', meaning, re.I): score -= 5
    unmarked = unicodedata.normalize('NFD', pinyin)
    if not re.search('[aeiou]', unmarked, re.I): score -= 10
    return score

while pos < len(idx):
    end = idx.index(0, pos)
    word = idx[pos:end].decode('utf8')
    offset, length = struct.unpack('>II', idx[end + 1:end + 9])
    text = definitions[offset:offset + length].decode('utf8')
    pos = end + 9
    senses = []
    for block in re.split(r'(?=^Pinyin:)', text, flags=re.M):
        pinyin = field(block, 'Pinyin')
        meaning = '\n'.join(line.lstrip('• ').strip() for line in block.splitlines() if line.startswith('•'))
        if pinyin:
            senses.append([pinyin, meaning])
    if not senses:
        raise ValueError('Missing reading: ' + word)
    best = max(senses, key=preference)
    # A broad, independently maintained default-reading table is used only for
    # isolated characters. Whole words keep their own CC-CEDICT pronunciation.
    preferred = preferred_readings.get(str(ord(word))) if len(word) == 1 else None
    if preferred:
        preferred = preferred.split(',')[0]
        best = next((s for s in senses if s[0] == preferred), best)
    dictionary[word] = [best[0], best[1], field(text, 'Simplified'), field(text, 'Traditional'), senses]

levels = json.loads((data / 'hsk.json').read_text(encoding='utf8'))
frequencies = {}
for line in args.frequencies.read_text(encoding='utf8').splitlines():
    word, frequency, *_ = line.split()
    if word in dictionary or word in levels:
        frequencies[word] = int(frequency)
# Share statistics across the written-form aliases, never across pronunciations.
for word, entry in dictionary.items():
    freq = max(frequencies.get(alias, 0) for alias in [word, entry[2], entry[3]])
    if freq: frequencies[word] = freq
for name, value in [('dictionary.json', dictionary), ('word-frequencies.json', frequencies)]:
    (data / name).write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')), encoding='utf8')
metadata = {'algorithm': 'deterministic word-frequency DAG, no HMM', 'frequency_source': 'https://github.com/fxsjy/jieba/blob/master/jieba/dict.txt', 'frequency_input_sha256': hashlib.sha256(args.frequencies.read_bytes()).hexdigest(), 'default_reading_source': 'https://github.com/mozillazg/python-pinyin/blob/master/pypinyin/pinyin_dict.json', 'default_reading_input_sha256': hashlib.sha256(args.readings.read_bytes()).hexdigest(), 'dictionary_headwords': len(dictionary), 'frequency_headwords': len(frequencies), 'multiple_reading_headwords': sum(len(v[4]) > 1 for v in dictionary.values())}
(data / 'reading-data-version.json').write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf8')
print(json.dumps(metadata))
