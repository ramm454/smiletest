# scripts/train-initial-model.py
#!/usr/bin/env python3
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
import sentencepiece as spm
import json
from pathlib import Path
import numpy as np
from tqdm import tqdm

class SimpleTranslationModel(nn.Module):
    """Simple initial translation model for bootstrapping"""
    
    def __init__(self, vocab_size, embed_size=256, hidden_size=512):
        super().__init__()
        self.encoder_embedding = nn.Embedding(vocab_size, embed_size)
        self.decoder_embedding = nn.Embedding(vocab_size, embed_size)
        
        self.encoder = nn.LSTM(embed_size, hidden_size, batch_first=True, bidirectional=True)
        self.decoder = nn.LSTM(embed_size, hidden_size * 2, batch_first=True)
        
        self.fc_out = nn.Linear(hidden_size * 2, vocab_size)
        
    def forward(self, src, tgt):
        src_embedded = self.encoder_embedding(src)
        tgt_embedded = self.decoder_embedding(tgt)
        
        encoder_output, (hidden, cell) = self.encoder(src_embedded)
        
        # Concatenate bidirectional outputs
        hidden = torch.cat([hidden[0:1], hidden[1:2]], dim=2)
        cell = torch.cat([cell[0:1], cell[1:2]], dim=2)
        
        decoder_output, _ = self.decoder(tgt_embedded, (hidden, cell))
        
        output = self.fc_out(decoder_output)
        return output

def train_initial_model():
    print("Training initial AI model...")
    
    # Load training data
    with open('training-data/initial_training.json', 'r', encoding='utf-8') as f:
        training_data = json.load(f)
    
    # Create tokenizers
    print("Creating tokenizers...")
    all_source_texts = [item['source'] for item in training_data]
    all_target_texts = [item['target'] for item in training_data]
    
    # Save corpus for tokenizer training
    with open('temp_source.txt', 'w', encoding='utf-8') as f:
        f.write('\n'.join(all_source_texts))
    
    with open('temp_target.txt', 'w', encoding='utf-8') as f:
        f.write('\n'.join(all_target_texts))
    
    # Train sentencepiece tokenizers
    spm.SentencePieceTrainer.train(
        input='temp_source.txt',
        model_prefix='source_spm',
        vocab_size=8000,
        character_coverage=1.0,
        model_type='bpe'
    )
    
    spm.SentencePieceTrainer.train(
        input='temp_target.txt',
        model_prefix='target_spm',
        vocab_size=8000,
        character_coverage=1.0,
        model_type='bpe'
    )
    
    # Clean up temp files
    Path('temp_source.txt').unlink()
    Path('temp_target.txt').unlink()
    
    # Load tokenizers
    source_sp = spm.SentencePieceProcessor(model_file='source_spm.model')
    target_sp = spm.SentencePieceProcessor(model_file='target_spm.model')
    
    # Prepare dataset
    class TranslationDataset(Dataset):
        def __init__(self, data, source_sp, target_sp, max_length=50):
            self.data = data
            self.source_sp = source_sp
            self.target_sp = target_sp
            self.max_length = max_length
            
        def __len__(self):
            return len(self.data)
            
        def __getitem__(self, idx):
            item = self.data[idx]
            
            src_ids = self.source_sp.encode(item['source'])
            tgt_ids = self.target_sp.encode(item['target'])
            
            # Add SOS and EOS tokens
            src_ids = [self.source_sp.bos_id()] + src_ids + [self.source_sp.eos_id()]
            tgt_ids = [self.target_sp.bos_id()] + tgt_ids + [self.target_sp.eos_id()]
            
            # Pad sequences
            src_ids = self.pad_sequence(src_ids, self.max_length)
            tgt_ids = self.pad_sequence(tgt_ids, self.max_length)
            
            return {
                'src': torch.tensor(src_ids, dtype=torch.long),
                'tgt': torch.tensor(tgt_ids, dtype=torch.long)
            }
        
        def pad_sequence(self, ids, max_length):
            if len(ids) > max_length:
                return ids[:max_length]
            return ids + [0] * (max_length - len(ids))
    
    dataset = TranslationDataset(training_data, source_sp, target_sp)
    dataloader = DataLoader(dataset, batch_size=16, shuffle=True)
    
    # Initialize model
    vocab_size = max(source_sp.vocab_size(), target_sp.vocab_size())
    model = SimpleTranslationModel(vocab_size)
    
    # Training setup
    criterion = nn.CrossEntropyLoss(ignore_index=0)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
    
    # Training loop
    print("Starting training...")
    num_epochs = 10
    
    for epoch in range(num_epochs):
        total_loss = 0
        model.train()
        
        for batch in tqdm(dataloader, desc=f'Epoch {epoch+1}/{num_epochs}'):
            src = batch['src']
            tgt = batch['tgt']
            
            optimizer.zero_grad()
            
            # Teacher forcing
            output = model(src, tgt[:, :-1])
            
            loss = criterion(
                output.reshape(-1, vocab_size),
                tgt[:, 1:].reshape(-1)
            )
            
            loss.backward()
            optimizer.step()
            
            total_loss += loss.item()
        
        avg_loss = total_loss / len(dataloader)
        print(f'Epoch {epoch+1}, Loss: {avg_loss:.4f}')
    
    # Save model
    model_dir = Path('ai-models/initial')
    model_dir.mkdir(parents=True, exist_ok=True)
    
    torch.save(model.state_dict(), model_dir / 'translation_model.pt')
    
    # Save tokenizers and config
    config = {
        'vocab_size': vocab_size,
        'embed_size': 256,
        'hidden_size': 512,
        'source_tokenizer': 'source_spm.model',
        'target_tokenizer': 'target_spm.model',
        'training_samples': len(training_data)
    }
    
    with open(model_dir / 'config.json', 'w') as f:
        json.dump(config, f, indent=2)
    
    print(f"Model saved to {model_dir}")
    
    # Also copy tokenizers
    import shutil
    shutil.copy('source_spm.model', model_dir / 'source_spm.model')
    shutil.copy('target_spm.model', model_dir / 'target_spm.model')
    
    print("Initial model training completed!")

if __name__ == '__main__':
    train_initial_model()