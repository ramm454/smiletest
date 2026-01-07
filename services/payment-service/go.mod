module payment-service

go 1.21

require (
    github.com/gin-gonic/gin v1.9.1
    github.com/stripe/stripe-go/v76 v76.0.0
    gorm.io/gorm v1.25.5
    gorm.io/driver/postgres v1.5.4
    github.com/redis/go-redis/v9 v9.2.1
    github.com/joho/godotenv v1.5.1
    github.com/swaggo/swag v1.16.2
    github.com/google/uuid v1.3.1
)

require (
    github.com/bytedance/sonic v1.10.1 // indirect
    github.com/cespare/xxhash/v2 v2.2.0 // indirect
    github.com/dgryski/go-rendezvous v0.0.0-20200823014737-9f7001d12a5f // indirect
    // ... other dependencies
)