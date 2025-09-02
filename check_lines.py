# Script to check specific lines in the file
with open('src/pages/admin/SettingsManagement.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Print lines around 853
for i in range(850, 856):
    if i <= len(lines):
        print(f'{i}: {repr(lines[i-1])}')