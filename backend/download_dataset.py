import urllib.request
import zipfile
import os
import shutil

REPO_URL = "https://github.com/LennysNewsletter/lennys-newsletterpodcastdata/archive/refs/heads/main.zip"
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data"))
ZIP_PATH = os.path.join(DATA_DIR, "dataset.zip")
EXTRACT_DIR = os.path.join(DATA_DIR, "lennys-podcast-data")

def download_dataset():
    os.makedirs(DATA_DIR, exist_ok=True)
    
    print(f"Downloading from {REPO_URL}...")
    try:
        req = urllib.request.Request(REPO_URL, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as response, open(ZIP_PATH, 'wb') as out_file:
            shutil.copyfileobj(response, out_file)
        print("Download complete.")
        
        print("Extracting zip file...")
        with zipfile.ZipFile(ZIP_PATH, 'r') as zip_ref:
            zip_ref.extractall(EXTRACT_DIR)
        print(f"Extracted to {EXTRACT_DIR}")
        
    except Exception as e:
        print(f"Failed to download or extract: {e}")
        print("Network restriction detected (e.g. connection reset).")
        print("Please manually download the zip from GitHub and extract it to 'data/lennys-podcast-data/'")

if __name__ == "__main__":
    download_dataset()
