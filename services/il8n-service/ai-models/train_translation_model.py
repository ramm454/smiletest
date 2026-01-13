# ai-models/train_translation_model.py
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import sentencepiece as spm
import numpy as np
import json
from pathlib import Path

class TranslationDataset(Dataset):
    def __init__(self, source_texts, target_texts, source_tokenizer, target_tokenizer, max_length=128):
        self.source_texts = source_texts
        self.target_texts = target_texts
        self.source_tokenizer = source_tokenizer
        self.target_tokenizer = target_tokenizer
        self.max_length = max_length
    
    def __len__(self):
        return len(self.source_texts)
    
    def __getitem__(self, idx):
        source = self.source_texts[idx]
        target = self.target_texts[idx]
        
        source_tokens = self.source_tokenizer.encode(source)
        target_tokens = self.target_tokenizer.encode(target)
        
        # Pad sequences
        source_tokens = self.pad_sequence(source_tokens, self.max_length)
        target_tokens = self.pad_sequence(target_tokens, self.max_length)
        
        return {
            'source': torch.tensor(source_tokens, dtype=torch.long),
            'target': torch.tensor(target_tokens, dtype=torch.long),
            'source_mask': torch.tensor([1] * len(source_tokens) + [0] * (self.max_length - len(source_tokens)), dtype=torch.long),
            'target_mask': torch.tensor([1] * len(target_tokens) + [0] * (self.max_length - len(target_tokens)), dtype=torch.long)
        }
    
    def pad_sequence(self, tokens, max_length):
        if len(tokens) > max_length:
            return tokens[:max_length]
        return tokens + [0] * (max_length - len(tokens))

class PositionalEncoding(nn.Module):
    def __init__(self, d_model, max_len=5000):
        super().__init__()
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, d_model, 2).float() * (-np.log(10000.0) / d_model))
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        pe = pe.unsqueeze(0)
        self.register_buffer('pe', pe)
    
    def forward(self, x):
        return x + self.pe[:, :x.size(1)]

class TranslationModel(nn.Module):
    def __init__(self, vocab_size, d_model=512, nhead=8, num_layers=6, dim_feedforward=2048):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, d_model)
        self.pos_encoder = PositionalEncoding(d_model)
        
        encoder_layer = nn.TransformerEncoderLayer(d_model, nhead, dim_feedforward)
        self.encoder = nn.TransformerEncoder(encoder_layer, num_layers)
        
        decoder_layer = nn.TransformerDecoderLayer(d_model, nhead, dim_feedforward)
        self.decoder = nn.TransformerDecoder(decoder_layer, num_layers)
        
        self.fc_out = nn.Linear(d_model, vocab_size)
        self.d_model = d_model
    
    def forward(self, src, tgt, src_mask=None, tgt_mask=None):
        src = self.embedding(src) * np.sqrt(self.d_model)
        src = self.pos_encoder(src)
        
        tgt = self.embedding(tgt) * np.sqrt(self.d_model)
        tgt = self.pos_encoder(tgt)
        
        memory = self.encoder(src, src_mask)
        output = self.decoder(tgt, memory, tgt_mask)
        output = self.fc_out(output)
        
        return output

def train_model(train_data, val_data, vocab_size, config):
    model = TranslationModel(vocab_size, **config)
    criterion = nn.CrossEntropyLoss(ignore_index=0)
    optimizer = optim.Adam(model.parameters(), lr=0.0001)
    
    train_loader = DataLoader(train_data, batch_size=32, shuffle=True)
    val_loader = DataLoader(val_data, batch_size=32)
    
    for epoch in range(config['epochs']):
        model.train()
        total_loss = 0
        
        for batch in train_loader:
            optimizer.zero_grad()
            
            src = batch['source']
            tgt = batch['target']
            
            # Teacher forcing
            tgt_input = tgt[:, :-1]
            tgt_output = tgt[:, 1:]
            
            output = model(src, tgt_input)
            loss = criterion(output.reshape(-1, vocab_size), tgt_output.reshape(-1))
            
            loss.backward()
            optimizer.step()
            
            total_loss += loss.item()
        
        avg_loss = total_loss / len(train_loader)
        print(f'Epoch {epoch+1}, Loss: {avg_loss:.4f}')
        
        # Validate
        model.eval()
        val_loss = 0
        with torch.no_grad():
            for batch in val_loader:
                src = batch['source']
                tgt = batch['target']
                tgt_input = tgt[:, :-1]
                tgt_output = tgt[:, 1:]
                
                output = model(src, tgt_input)
                loss = criterion(output.reshape(-1, vocab_size), tgt_output.reshape(-1))
                val_loss += loss.item()
        
        print(f'Validation Loss: {val_loss/len(val_loader):.4f}')
    
    return model