# ai-models/advanced_transformer.py
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.nn import TransformerEncoder, TransformerEncoderLayer
import math

class AdaptiveTranslationModel(nn.Module):
    """Advanced transformer model with domain adaptation"""
    
    def __init__(self, vocab_size, d_model=512, nhead=8, num_layers=6, 
                 num_domains=5, num_languages=10):
        super().__init__()
        
        self.d_model = d_model
        self.vocab_size = vocab_size
        
        # Embeddings
        self.token_embedding = nn.Embedding(vocab_size, d_model)
        self.position_embedding = PositionalEncoding(d_model)
        
        # Domain-specific adapters
        self.domain_embeddings = nn.Embedding(num_domains, d_model)
        self.domain_projectors = nn.ModuleList([
            nn.Sequential(
                nn.Linear(d_model, d_model // 4),
                nn.ReLU(),
                nn.Linear(d_model // 4, d_model)
            ) for _ in range(num_domains)
        ])
        
        # Language-specific adapters
        self.language_embeddings = nn.Embedding(num_languages, d_model)
        
        # Transformer layers
        encoder_layer = TransformerEncoderLayer(d_model, nhead, dim_feedforward=2048)
        self.encoder = TransformerEncoder(encoder_layer, num_layers)
        
        decoder_layer = TransformerDecoderLayer(d_model, nhead, dim_feedforward=2048)
        self.decoder = TransformerDecoder(decoder_layer, num_layers)
        
        # Output layer
        self.output_projection = nn.Linear(d_model, vocab_size)
        
        # Attention heads for different translation aspects
        self.semantic_attention = nn.MultiheadAttention(d_model, nhead // 2)
        self.syntactic_attention = nn.MultiheadAttention(d_model, nhead // 2)
        
        # Context gate for controlling information flow
        self.context_gate = nn.Sequential(
            nn.Linear(d_model * 2, d_model),
            nn.Sigmoid()
        )
        
        # Initialize weights
        self._init_weights()
    
    def _init_weights(self):
        for p in self.parameters():
            if p.dim() > 1:
                nn.init.xavier_uniform_(p)
    
    def forward(self, src, tgt, src_mask=None, tgt_mask=None, 
                domain_id=None, src_lang_id=None, tgt_lang_id=None,
                memory=None):
        
        # Embed tokens
        src_emb = self.token_embedding(src) * math.sqrt(self.d_model)
        tgt_emb = self.token_embedding(tgt) * math.sqrt(self.d_model)
        
        # Add positional encoding
        src_emb = self.position_embedding(src_emb)
        tgt_emb = self.position_embedding(tgt_emb)
        
        # Add domain-specific information if provided
        if domain_id is not None:
            domain_emb = self.domain_embeddings(domain_id).unsqueeze(1)
            src_emb = src_emb + domain_emb.expand_as(src_emb)
            # Apply domain projector
            domain_proj = self.domain_projectors[domain_id](src_emb)
            src_emb = src_emb + 0.1 * domain_proj  # Residual connection
        
        # Add language-specific information
        if src_lang_id is not None:
            lang_emb = self.language_embeddings(src_lang_id).unsqueeze(1)
            src_emb = src_emb + 0.05 * lang_emb.expand_as(src_emb)
        
        if tgt_lang_id is not None:
            lang_emb = self.language_embeddings(tgt_lang_id).unsqueeze(1)
            tgt_emb = tgt_emb + 0.05 * lang_emb.expand_as(tgt_emb)
        
        # Encode source
        if memory is None:
            memory = self.encoder(src_emb, src_mask)
        
        # Apply specialized attention heads
        semantic_memory, _ = self.semantic_attention(memory, memory, memory)
        syntactic_memory, _ = self.syntactic_attention(memory, memory, memory)
        
        # Combine attention results with context gate
        gate = self.context_gate(torch.cat([semantic_memory, syntactic_memory], dim=-1))
        enhanced_memory = gate * semantic_memory + (1 - gate) * syntactic_memory
        
        # Decode
        output = self.decoder(tgt_emb, enhanced_memory, tgt_mask)
        
        # Project to vocabulary
        output = self.output_projection(output)
        
        return output, enhanced_memory
    
    def adapt_to_new_domain(self, domain_data, new_domain_id, epochs=5, lr=0.0001):
        """Fine-tune the model for a new domain"""
        optimizer = torch.optim.Adam(self.parameters(), lr=lr)
        criterion = nn.CrossEntropyLoss(ignore_index=0)
        
        # Create new domain projector if needed
        if new_domain_id >= len(self.domain_projectors):
            new_projector = nn.Sequential(
                nn.Linear(self.d_model, self.d_model // 4),
                nn.ReLU(),
                nn.Linear(self.d_model // 4, self.d_model)
            )
            self.domain_projectors.append(new_projector)
        
        self.train()
        for epoch in range(epochs):
            total_loss = 0
            for batch in domain_data:
                src, tgt = batch['src'], batch['tgt']
                
                optimizer.zero_grad()
                
                output, _ = self(
                    src, tgt[:, :-1],
                    domain_id=torch.tensor([new_domain_id]),
                    src_lang_id=batch.get('src_lang'),
                    tgt_lang_id=batch.get('tgt_lang')
                )
                
                loss = criterion(
                    output.reshape(-1, self.vocab_size),
                    tgt[:, 1:].reshape(-1)
                )
                
                loss.backward()
                optimizer.step()
                total_loss += loss.item()
            
            print(f'Domain adaptation epoch {epoch+1}, Loss: {total_loss/len(domain_data):.4f}')
    
    def translate_with_confidence(self, text, target_lang, source_lang='auto', 
                                 temperature=0.7, beam_size=5, return_all=False):
        """Translate with confidence scores and multiple hypotheses"""
        
        # Tokenize input
        src_tokens = self.tokenizer.encode(text)
        
        # Generate multiple hypotheses with beam search
        hypotheses = self.beam_search(
            src_tokens, 
            target_lang,
            beam_size=beam_size,
            temperature=temperature
        )
        
        # Calculate confidence scores
        confidences = []
        for hyp in hypotheses:
            # Calculate probability of hypothesis
            prob = self.calculate_sequence_probability(src_tokens, hyp['tokens'])
            
            # Additional confidence metrics
            semantic_score = self.semantic_similarity(text, hyp['text'])
            fluency_score = self.fluency_score(hyp['text'])
            
            # Combined confidence
            confidence = 0.6 * prob + 0.3 * semantic_score + 0.1 * fluency_score
            hyp['confidence'] = confidence
            confidences.append(confidence)
        
        # Normalize confidence scores
        if confidences:
            conf_sum = sum(confidences)
            for i, hyp in enumerate(hypotheses):
                hyp['normalized_confidence'] = confidences[i] / conf_sum
        
        if return_all:
            return sorted(hypotheses, key=lambda x: x['confidence'], reverse=True)
        else:
            return hypotheses[0] if hypotheses else None
    
    def beam_search(self, src_tokens, target_lang, beam_size=5, max_length=100, temperature=1.0):
        """Beam search for translation generation"""
        
        # Encode source
        src_tensor = torch.tensor([src_tokens])
        src_emb = self.token_embedding(src_tensor) * math.sqrt(self.d_model)
        src_emb = self.position_embedding(src_emb)
        memory = self.encoder(src_emb)
        
        # Initialize beams
        start_token = self.target_tokenizer.bos_token_id
        beams = [{
            'tokens': [start_token],
            'score': 0.0,
            'memory': memory
        }]
        
        completed = []
        
        for step in range(max_length):
            new_beams = []
            
            for beam in beams:
                if beam['tokens'][-1] == self.target_tokenizer.eos_token_id:
                    completed.append(beam)
                    continue
                
                # Decode next token
                tgt_tensor = torch.tensor([beam['tokens']])
                tgt_emb = self.token_embedding(tgt_tensor) * math.sqrt(self.d_model)
                tgt_emb = self.position_embedding(tgt_emb)
                
                output, _ = self.decoder(tgt_emb, beam['memory'])
                logits = self.output_projection(output[:, -1, :]) / temperature
                probs = F.softmax(logits, dim=-1)
                
                # Get top candidates
                top_probs, top_indices = torch.topk(probs[0], beam_size * 2)
                
                for prob, token in zip(top_probs, top_indices):
                    new_beam = {
                        'tokens': beam['tokens'] + [token.item()],
                        'score': beam['score'] + math.log(prob.item()),
                        'memory': beam['memory']
                    }
                    new_beams.append(new_beam)
            
            # Select top beams
            new_beams.sort(key=lambda x: x['score'], reverse=True)
            beams = new_beams[:beam_size]
            
            # Check if all beams are completed
            if all(b['tokens'][-1] == self.target_tokenizer.eos_token_id for b in beams):
                completed.extend(beams)
                break
        
        # Convert tokens to text
        for beam in completed:
            beam['text'] = self.target_tokenizer.decode(beam['tokens'][1:-1])  # Remove BOS/EOS
        
        return sorted(completed, key=lambda x: x['score'], reverse=True)
    
    def calculate_sequence_probability(self, src_tokens, tgt_tokens):
        """Calculate probability of target sequence given source"""
        src_tensor = torch.tensor([src_tokens])
        tgt_tensor = torch.tensor([tgt_tokens])
        
        output, _ = self(src_tensor, tgt_tensor[:, :-1])
        log_probs = F.log_softmax(output, dim=-1)
        
        # Calculate sequence probability
        total_log_prob = 0
        for t in range(len(tgt_tokens) - 1):
            token_prob = log_probs[0, t, tgt_tokens[t + 1]]
            total_log_prob += token_prob.item()
        
        return math.exp(total_log_prob / (len(tgt_tokens) - 1))
    
    def semantic_similarity(self, src_text, tgt_text):
        """Calculate semantic similarity between source and translation"""
        # This could use a separate semantic model or embeddings
        # For now, return a placeholder
        return 0.9
    
    def fluency_score(self, text):
        """Calculate fluency score of generated text"""
        # This could use a language model
        # For now, return a placeholder
        return 0.95

class PositionalEncoding(nn.Module):
    def __init__(self, d_model, max_len=5000):
        super().__init__()
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        pe = pe.unsqueeze(0)
        self.register_buffer('pe', pe)
    
    def forward(self, x):
        return x + self.pe[:, :x.size(1)]

class TransformerDecoderLayer(nn.Module):
    """Custom decoder layer with additional features"""
    
    def __init__(self, d_model, nhead, dim_feedforward=2048, dropout=0.1):
        super().__init__()
        self.self_attn = nn.MultiheadAttention(d_model, nhead, dropout=dropout)
        self.multihead_attn = nn.MultiheadAttention(d_model, nhead, dropout=dropout)
        
        # Feedforward
        self.linear1 = nn.Linear(d_model, dim_feedforward)
        self.dropout = nn.Dropout(dropout)
        self.linear2 = nn.Linear(dim_feedforward, d_model)
        
        # Normalization
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)
        self.norm3 = nn.LayerNorm(d_model)
        
        # Dropout
        self.dropout1 = nn.Dropout(dropout)
        self.dropout2 = nn.Dropout(dropout)
        self.dropout3 = nn.Dropout(dropout)
        
        # Gating mechanism
        self.gate = nn.Linear(d_model * 2, d_model)
        
        # Activation
        self.activation = F.relu
    
    def forward(self, tgt, memory, tgt_mask=None, memory_mask=None):
        # Self attention
        tgt2, _ = self.self_attn(tgt, tgt, tgt, attn_mask=tgt_mask)
        tgt = tgt + self.dropout1(tgt2)
        tgt = self.norm1(tgt)
        
        # Cross attention
        tgt2, attention_weights = self.multihead_attn(
            tgt, memory, memory, attn_mask=memory_mask
        )
        
        # Gated residual connection
        gate_input = torch.cat([tgt, tgt2], dim=-1)
        gate = torch.sigmoid(self.gate(gate_input))
        tgt = tgt + gate * self.dropout2(tgt2)
        tgt = self.norm2(tgt)
        
        # Feedforward
        tgt2 = self.linear2(self.dropout(self.activation(self.linear1(tgt))))
        tgt = tgt + self.dropout3(tgt2)
        tgt = self.norm3(tgt)
        
        return tgt, attention_weights

class TransformerDecoder(nn.Module):
    def __init__(self, decoder_layer, num_layers):
        super().__init__()
        self.layers = nn.ModuleList([decoder_layer for _ in range(num_layers)])
    
    def forward(self, tgt, memory, tgt_mask=None, memory_mask=None):
        output = tgt
        attention_weights = []
        
        for layer in self.layers:
            output, attn = layer(output, memory, tgt_mask, memory_mask)
            attention_weights.append(attn)
        
        return output, attention_weights