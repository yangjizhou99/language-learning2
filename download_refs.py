import os
import requests

refs = {
    "1_Settles_2016.pdf": "https://aclanthology.org/P16-1174.pdf",
    "2_Zhang_2017.pdf": "https://arxiv.org/pdf/1702.07311.pdf",
    "4_Choi_2020.pdf": "https://arxiv.org/pdf/1912.03072.pdf",
    "5_Piech_2015.pdf": "https://arxiv.org/pdf/1506.05908.pdf",
    "6_Vaswani_2017.pdf": "https://arxiv.org/pdf/1706.03762.pdf",
    "7_OpenAI_2023.pdf": "https://arxiv.org/pdf/2303.08774.pdf",
    "8_Touvron_2023.pdf": "https://arxiv.org/pdf/2307.09288.pdf",
    "9_Corbett_1994.pdf": "http://act-r.psy.cmu.edu/papers/CorbettAnderson1995.pdf",
    "13_Brown_2020.pdf": "https://arxiv.org/pdf/2005.14165.pdf"
}

output_dir = "docs/paper/references"
os.makedirs(output_dir, exist_ok=True)

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}

for filename, url in refs.items():
    path = os.path.join(output_dir, filename)
    if os.path.exists(path):
        print(f"Skipping {filename} (already exists)")
        continue
    
    print(f"Downloading {filename} from {url}...")
    try:
        r = requests.get(url, headers=headers, timeout=15)
        if r.status_code == 200:
            with open(path, 'wb') as f:
                f.write(r.content)
            print("Success.")
        else:
            print(f"Failed: Status {r.status_code}")
    except Exception as e:
        print(f"Error: {e}")
