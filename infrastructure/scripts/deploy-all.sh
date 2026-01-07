#!/bin/bash

# 1. Initialize Terraform
cd infrastructure/terraform
terraform init
terraform apply -auto-approve

# Get server IP
SERVER_IP=$(terraform output -raw server_ip)
echo "Server deployed at: $SERVER_IP"

# 2. Wait for server to be ready
sleep 60

# 3. Copy files to server
scp -r ../../* root@$SERVER_IP:/opt/yoga-spa-platform/

# 4. Build and push images
cd ../..
services=("frontend" "api-gateway" "user-service" "payment-service" "booking-service")

for service in "${services[@]}"; do
    echo "Building $service..."
    docker build -t your-registry/yoga-spa-$service:latest ./$service
    docker push your-registry/yoga-spa-$service:latest
done

# 5. Deploy to Kubernetes
ssh root@$SERVER_IP << 'EOF'
    cd /opt/yoga-spa-platform
    
    # Apply all manifests
    kubectl apply -f kubernetes/namespaces.yaml
    kubectl apply -f kubernetes/configs/
    kubectl apply -f kubernetes/deployments/
    kubectl apply -f kubernetes/ingress/
    
    # Setup cert-manager
    kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.12.0/cert-manager.yaml
    sleep 30
    
    # Create cluster issuer
    cat > cluster-issuer.yaml << 'EOL'
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@yoga-spa.example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOL
    kubectl apply -f cluster-issuer.yaml
    
    echo "Deployment complete!"
    echo "Access your application at: http://$SERVER_IP"
    echo "Or setup DNS for: yoga-spa.example.com"
EOF