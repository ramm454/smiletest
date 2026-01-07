terraform {
  required_version = ">= 1.0"
  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.42"
    }
  }
}

provider "hcloud" {
  token = var.hcloud_token
}

# SSH Key
resource "hcloud_ssh_key" "default" {
  name       = "yoga-spa-key"
  public_key = file("~/.ssh/id_rsa.pub")
}

# Server
resource "hcloud_server" "yoga_spa" {
  name        = "yoga-spa-prod"
  image       = "ubuntu-22.04"
  server_type = "cpx31" # 8 vCPU, 16 GB RAM
  location    = "hel1"
  ssh_keys    = [hcloud_ssh_key.default.id]
  
  user_data = file("${path.module}/cloud-init.yaml")
  
  labels = {
    environment = "production"
    app         = "yoga-spa"
  }
}

# Firewall
resource "hcloud_firewall" "yoga_spa_fw" {
  name = "yoga-spa-firewall"
  
  rule {
    direction = "in"
    protocol  = "tcp"
    port      = "22"
    source_ips = ["0.0.0.0/0"]
  }
  
  rule {
    direction = "in"
    protocol  = "tcp"
    port      = "80"
    source_ips = ["0.0.0.0/0"]
  }
  
  rule {
    direction = "in"
    protocol  = "tcp"
    port      = "443"
    source_ips = ["0.0.0.0/0"]
  }
  
  rule {
    direction = "in"
    protocol  = "tcp"
    port      = "3000-3010"
    source_ips = ["0.0.0.0/0"]
  }
  
  rule {
    direction = "in"
    protocol  = "tcp"
    port      = "6443"
    source_ips = ["0.0.0.0/0"]
  }
}

resource "hcloud_firewall_attachment" "yoga_spa_fw_attach" {
  firewall_id = hcloud_firewall.yoga_spa_fw.id
  server_ids  = [hcloud_server.yoga_spa.id]
}

# Output
output "server_ip" {
  value = hcloud_server.yoga_spa.ipv4_address
}

output "server_url" {
  value = "http://${hcloud_server.yoga_spa.ipv4_address}"
}