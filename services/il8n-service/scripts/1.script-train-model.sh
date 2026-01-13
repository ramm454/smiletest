#!/bin/bash
# scripts/train-model.sh

set -e

echo "🚀 Starting AI Model Training"
echo "============================="

# Activate Python environment
source venv/bin/activate

# Step 1: Collect training data
echo "📊 Step 1: Collecting training data..."
python scripts/collect-training-data.py

# Step 2: Train initial model
echo "🤖 Step 2: Training initial model..."
python scripts/train-initial-model.py

# Step 3: Test the model
echo "🧪 Step 3: Testing model..."
python scripts/test-model.py

# Step 4: Deploy model to service
echo "🚚 Step 4: Deploying model..."
cp -r ai-models/initial/* src/ai-models/

echo "✅ Model training and deployment completed!"