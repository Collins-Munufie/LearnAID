file_path = r"c:\Users\HP\Documents\Learn AID\backend\main.py"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

old_regex = 'allow_origin_regex = r"^(https?://(localhost|127\\.0\\.0\\.1)(:\\d+)?|https?://[a-zA-Z0-9-]+\\.vercel\\.app|https?://[a-zA-Z0-9-]+\\.github\\.io)$"'
new_regex = 'allow_origin_regex = r".*"'

content = content.replace(old_regex, new_regex)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Updated CORS in main.py")
