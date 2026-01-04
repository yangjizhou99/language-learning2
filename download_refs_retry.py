import os
import requests

refs = {
    "9_Corbett_1994.pdf": "https://userlab.cs.uni-tuebingen.de/files/corbett94knowledge.pdf",
    "10_Chen_2023.pdf": "https://arxiv.org/pdf/2308.00000.pdf",
    "12_Pokrivcakova_2019.pdf": "https://sciendo.com/pdf/10.2478/jolace-2019-0013"
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
