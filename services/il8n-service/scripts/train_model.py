# scripts/train_model.py
#!/usr/bin/env python3
import sys
import json
import argparse
from pathlib import Path
from train_translation_model import TranslationModel, TranslationDataset, train_model
import sentencepiece as spm

def prepare_tokenizer(texts, model_prefix, vocab_size=32000):
    """Train SentencePiece tokenizer"""
    with open('temp_corpus.txt', 'w', encoding='utf-8') as f:
        for text in texts:
            f.write(text + '\n')
    
    spm.SentencePieceTrainer.train(
        input='temp_corpus.txt',
        model_prefix=model_prefix,
        vocab_size=vocab_size,
        character_coverage=1.0,
        model_type='bpe'
    )
    
    Path('temp_corpus.txt').unlink()
    return spm.SentencePieceProcessor(model_file=f'{model_prefix}.model')

def main():
    parser = argparse.ArgumentParser(description='Train custom translation model')
    parser.add_argument('--dataset', required=True, help='Path to training dataset JSON')
    parser.add_argument('--output-dir', default='./models', help='Output directory')
    parser.add_argument('--epochs', type=int, default=10, help='Number of training epochs')
    parser.add_argument('--vocab-size', type=int, default=32000, help='Vocabulary size')
    
    args = parser.parse_args()
    
    # Load dataset
    with open(args.dataset, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    source_texts = [item['source'] for item in data]
    target_texts = [item['target'] for item in data]
    
    # Prepare tokenizers
    print("Training tokenizers...")
    source_tokenizer = prepare_tokenizer(source_texts, 'source', args.vocab_size)
    target_tokenizer = prepare_tokenizer(target_texts, 'target', args.vocab_size)
    
    # Create datasets
    dataset = TranslationDataset(
        source_texts,
        target_texts,
        source_tokenizer,
        target_tokenizer
    )
    
    # Split dataset
    train_size = int(0.8 * len(dataset))
    val_size = len(dataset) - train_size
    train_dataset, val_dataset = torch.utils.data.random_split(dataset, [train_size, val_size])
    
    # Train model
    print("Training model...")
    config = {
        'd_model': 512,
        'nhead': 8,
        'num_layers': 6,
        'dim_feedforward': 2048,
        'epochs': args.epochs
    }
    
    model = train_model(train_dataset, val_dataset, args.vocab_size, config)
    
    # Save model
    output_dir = Path(args.output_dir)
    output_dir.mkdir(exist_ok=True)
    
    torch.save(model.state_dict(), output_dir / 'translation_model.pt')
    
    # Save tokenizers and config
    with open(output_dir / 'config.json', 'w') as f:
        json.dump({
            'vocab_size': args.vocab_size,
            'config': config,
            'source_tokenizer': 'source.model',
            'target_tokenizer': 'target.model'
        }, f, indent=2)
    
    print(f"Model saved to {output_dir}")

if __name__ == '__main__':
    main()