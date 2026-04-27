from bs4 import BeautifulSoup

with open("test_100x.html") as f:
    html = f.read()

soup = BeautifulSoup(html, "lxml")

TAGS_TO_REMOVE = [
    "script", "style", "nav", "footer", "header",
    "iframe", "noscript", "form", "svg", "img",
    "button", "input", "select", "textarea",
]
for tag_name in TAGS_TO_REMOVE:
    for tag in soup.find_all(tag_name):
        tag.decompose()

main_content = soup.find("main") or soup.find("article") or soup.find("body")

CONTENT_TAGS = [
    "p", "h1", "h2", "h3", "h4", "h5", "h6",
    "li", "td", "th", "blockquote", "article",
    "section", "main", "div",
]

text_parts = []
for element in main_content.find_all(CONTENT_TAGS):
    text = element.get_text(strip=True)
    if text and len(text) > 20:
        text_parts.append(text)

print(f"Parts from tags: {len(text_parts)}")
if len(text_parts) > 0:
    print(f"First part: {text_parts[0][:50]}")

if len(text_parts) < 3:
    print("Falling back...")
    text_parts = [
        line.strip()
        for line in main_content.get_text(separator="\n").split("\n")
        if line.strip() and len(line.strip()) > 20
    ]

print(f"Total parts: {len(text_parts)}")
