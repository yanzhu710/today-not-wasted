import re
import sys

filepath = sys.argv[1] if len(sys.argv) > 1 else 'js/pages/onboard.js'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

stack = []
in_string = None
in_block_comment = False
line_num = 1

for line in lines:
    in_line_comment = False
    col = 0
    while col < len(line):
        ch = line[col]
        if in_block_comment:
            if ch == '*' and col+1 < len(line) and line[col+1] == '/':
                in_block_comment = False
                col += 2
                continue
            col += 1
            continue
        if in_line_comment:
            break
        if in_string:
            if ch == '\\':
                col += 2
                continue
            if ch == in_string:
                in_string = None
            col += 1
            continue
        if ch == '/' and col+1 < len(line) and line[col+1] == '/':
            in_line_comment = True
            break
        if ch == '/' and col+1 < len(line) and line[col+1] == '*':
            in_block_comment = True
            col += 2
            continue
        if ch in ('"', "'", '`'):
            in_string = ch
            col += 1
            continue
        if ch in '([{':
            stack.append((ch, line_num, col+1))
        elif ch in ')]}':
            if not stack:
                print(f'Unmatched closing {ch} at line {line_num}, col {col+1}')
            else:
                open_ch, ol, oc = stack.pop()
                pairs = {'(': ')', '[': ']', '{': '}'}
                if pairs.get(open_ch) != ch:
                    print(f'Mismatch: opened {open_ch} at line {ol}:{oc}, closed with {ch} at line {line_num}:{col+1}')
        col += 1
    line_num += 1

if stack:
    print(f'Unclosed brackets ({len(stack)} total):')
    for ch, l, c in stack[-15:]:
        print(f'  {ch} at line {l}, col {c}')
else:
    print('All brackets balanced!')
