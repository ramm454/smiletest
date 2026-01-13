# scripts/collect_training_data.py
import json
from pathlib import Path
import requests
from bs4 import BeautifulSoup
import pandas as pd

def collect_multilingual_data():
    """Collect parallel text data for training"""
    
    # Sources for parallel text (you'll need to find legal sources)
    sources = [
        # United Nations documents (public domain)
        'https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/ZJLXQT',
        
        # European Parliament proceedings
        'https://www.statmt.org/europarl/',
        
        # OpenSubtitles
        'https://www.opensubtitles.org/',
        
        # Tatoeba (community translations)
        'https://tatoeba.org/eng/downloads'
    ]
    
    # This is a placeholder - you'll need to implement actual collection
    # based on the terms of service of each source
    
    training_data = []
    
    # Example: Collect from local files or existing datasets
    datasets_dir = Path('./datasets')
    for file in datasets_dir.glob('*.json'):
        with open(file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            training_data.extend(data)
    
    return training_data

def preprocess_data(data):
    """Clean and preprocess training data"""
    processed = []
    
    for item in data:
        # Clean text
        source = item['source'].strip()
        target = item['target'].strip()
        
        # Remove special characters, normalize whitespace
        source = ' '.join(source.split())
        target = ' '.join(target.split())
        
        # Filter by length
        if 3 <= len(source.split()) <= 100 and 3 <= len(target.split()) <= 100:
            processed.append({
                'source': source,
                'target': target,
                'source_lang': item.get('source_lang', 'en'),
                'target_lang': item.get('target_lang', 'de')
            })
    
    return processed

def create_dataset():
    """Create training dataset"""
    print("Collecting data...")
    raw_data = collect_multilingual_data()
    
    print("Preprocessing data...")
    processed_data = preprocess_data(raw_data)
    
    print(f"Collected {len(processed_data)} translation pairs")
    
    # Split into train/val/test
    train_size = int(0.8 * len(processed_data))
    val_size = int(0.1 * len(processed_data))
    
    train_data = processed_data[:train_size]
    val_data = processed_data[train_size:train_size + val_size]
    test_data = processed_data[train_size + val_size:]
    
    # Save datasets
    datasets_dir = Path('./training-data')
    datasets_dir.mkdir(exist_ok=True)
    
    with open(datasets_dir / 'train.json', 'w', encoding='utf-8') as f:
        json.dump(train_data, f, ensure_ascii=False, indent=2)
    
    with open(datasets_dir / 'val.json', 'w', encoding='utf-8') as f:
        json.dump(val_data, f, ensure_ascii=False, indent=2)
    
    with open(datasets_dir / 'test.json', 'w', encoding='utf-8') as f:
        json.dump(test_data, f, ensure_ascii=False, indent=2)
    
    print("Dataset created successfully!")

if __name__ == '__main__':
    create_dataset()