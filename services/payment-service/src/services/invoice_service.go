package services

import (
    "bytes"
    "context"
    "fmt"
    "html/template"
    "os"
    "path/filepath"
    "time"
    
    "github.com/SebastiaanKlippert/go-wkhtmltopdf"
    "github.com/google/uuid"
    "gorm.io/gorm"
    
    "payment-service/models"
)

type InvoiceService struct {
    db            *gorm.DB
    templateDir   string
    outputDir     string
    companyInfo   CompanyInfo
}

type CompanyInfo struct {
    Name        string
    Address     string
    City        string
    State       string
    Zip         string
    Country     string
    Phone       string
    Email       string
    Website     string
    TaxID       string // GST/VAT number
    LogoURL     string
}

type InvoiceData struct {
    InvoiceNumber  string
    InvoiceDate    string
    DueDate        string
    Company        CompanyInfo
    Customer       CustomerInfo
    Items          []InvoiceItem
    Subtotal       float64
    TaxAmount      float64
    TaxRate        float64
    TotalAmount    float64
    AmountPaid     float64
    BalanceDue     float64
    Currency       string
    PaymentMethod  string
    PaymentDate    string
    TransactionID  string
    Notes          string
    Terms          string
}

type CustomerInfo struct {
    Name     string
    Email    string
    Phone    string
    Address  string
    City     string
    State    string
    Zip      string
    Country  string
    TaxID    string // Customer tax ID if any
}

type InvoiceItem struct {
    Description string
    Quantity    float64
    UnitPrice   float64
    TotalPrice  float64
    TaxRate     float64
    TaxAmount   float64
}

func NewInvoiceService(db *gorm.DB, companyInfo CompanyInfo) *InvoiceService {
    return &InvoiceService{
        db:          db,
        templateDir: "./templates/invoices",
        outputDir:   "./invoices",
        companyInfo: companyInfo,
    }
}

// GenerateInvoice creates an invoice for a payment
func (s *InvoiceService) GenerateInvoice(ctx context.Context, payment models.Payment) (*models.Invoice, error) {
    // Get customer info from user service
    customer, err := s.getCustomerInfo(ctx, payment.UserID)
    if err != nil {
        return nil, fmt.Errorf("failed to get customer info: %w", err)
    }
    
    // Get invoice items based on payment type
    items, err := s.getInvoiceItems(ctx, payment)
    if err != nil {
        return nil, fmt.Errorf("failed to get invoice items: %w", err)
    }
    
    // Calculate taxes
    taxRate := s.getTaxRate(customer.Country, customer.State)
    subtotal := s.calculateSubtotal(items)
    taxAmount := subtotal * taxRate / 100
    totalAmount := subtotal + taxAmount
    
    // Prepare invoice data
    invoiceNumber := s.generateInvoiceNumber()
    
    invoiceData := InvoiceData{
        InvoiceNumber: invoiceNumber,
        InvoiceDate:   time.Now().Format("January 2, 2006"),
        DueDate:       time.Now().AddDate(0, 0, 30).Format("January 2, 2006"), // 30 days
        Company:       s.companyInfo,
        Customer:      customer,
        Items:         items,
        Subtotal:      subtotal,
        TaxAmount:     taxAmount,
        TaxRate:       taxRate,
        TotalAmount:   totalAmount,
        AmountPaid:    float64(payment.Amount) / 100, // Convert from cents
        BalanceDue:    0, // Paid in full
        Currency:      payment.Currency,
        PaymentMethod: payment.Gateway,
        PaymentDate:   payment.PaidAt.Format("January 2, 2006"),
        TransactionID: payment.GatewayPaymentID,
        Notes:         payment.Description,
        Terms:         "Payment due within 30 days. Late fees may apply.",
    }
    
    // Generate PDF
    pdfPath, err := s.generatePDF(invoiceData)
    if err != nil {
        return nil, fmt.Errorf("failed to generate PDF: %w", err)
    }
    
    // Generate HTML (for email)
    htmlContent, err := s.generateHTML(invoiceData)
    if err != nil {
        return nil, fmt.Errorf("failed to generate HTML: %w", err)
    }
    
    // Save invoice to database
    invoice := models.Invoice{
        ID:             uuid.New().String(),
        InvoiceNumber:  invoiceNumber,
        UserID:         payment.UserID,
        PaymentID:      payment.ID,
        Status:         "paid",
        Amount:         payment.Amount,
        Currency:       payment.Currency,
        TaxAmount:      int64(taxAmount * 100), // Convert to cents
        TaxRate:        taxRate,
        InvoiceDate:    time.Now(),
        DueDate:        time.Now().AddDate(0, 0, 30),
        PDFURL:         pdfPath,
        Items:          s.convertItemsToJSON(items),
        Metadata: map[string]interface{}{
            "payment_gateway": payment.Gateway,
            "transaction_id":  payment.GatewayPaymentID,
            "payment_date":    payment.PaidAt,
        },
        CreatedAt:      time.Now(),
    }
    
    if err := s.db.Create(&invoice).Error; err != nil {
        return nil, fmt.Errorf("failed to save invoice: %w", err)
    }
    
    // Send invoice email
    go s.sendInvoiceEmail(ctx, customer.Email, htmlContent, pdfPath, invoiceData)
    
    return &invoice, nil
}

func (s *InvoiceService) getCustomerInfo(ctx context.Context, userID string) (CustomerInfo, error) {
    // Call user service to get customer details
    // For now, return mock data
    return CustomerInfo{
        Name:    "John Doe",
        Email:   "john@example.com",
        Phone:   "+1-555-123-4567",
        Address: "123 Main Street",
        City:    "New York",
        State:   "NY",
        Zip:     "10001",
        Country: "US",
    }, nil
}

func (s *InvoiceService) getInvoiceItems(ctx context.Context, payment models.Payment) ([]InvoiceItem, error) {
    items := []InvoiceItem{}
    
    // Determine items based on payment type/metadata
    if paymentType, ok := payment.Metadata["payment_type"].(string); ok {
        switch paymentType {
        case "booking":
            items = s.getBookingInvoiceItems(payment)
        case "ecommerce":
            items = s.getEcommerceInvoiceItems(payment)
        case "subscription":
            items = s.getSubscriptionInvoiceItems(payment)
        default:
            // Generic invoice item
            items = []InvoiceItem{
                {
                    Description: payment.Description,
                    Quantity:    1,
                    UnitPrice:   float64(payment.Amount) / 100,
                    TotalPrice:  float64(payment.Amount) / 100,
                    TaxRate:     0,
                    TaxAmount:   0,
                },
            }
        }
    }
    
    return items, nil
}

func (s *InvoiceService) getBookingInvoiceItems(payment models.Payment) []InvoiceItem {
    items := []InvoiceItem{}
    
    // Extract booking details from metadata
    if metadata, ok := payment.Metadata["booking_details"].(map[string]interface{}); ok {
        className, _ := metadata["class_name"].(string)
        instructor, _ := metadata["instructor"].(string)
        date, _ := metadata["date"].(string)
        timeStr, _ := metadata["time"].(string)
        participants, _ := metadata["participants"].(float64)
        
        description := fmt.Sprintf("%s with %s - %s at %s", 
            className, instructor, date, timeStr)
        
        items = append(items, InvoiceItem{
            Description: description,
            Quantity:    participants,
            UnitPrice:   float64(payment.Amount) / 100 / participants,
            TotalPrice:  float64(payment.Amount) / 100,
            TaxRate:     0, // Services might be tax-exempt
            TaxAmount:   0,
        })
    }
    
    return items
}

func (s *InvoiceService) getEcommerceInvoiceItems(payment models.Payment) []InvoiceItem {
    items := []InvoiceItem{}
    
    // Extract order items from metadata
    if itemsData, ok := payment.Metadata["items"].([]interface{}); ok {
        for _, item := range itemsData {
            itemMap := item.(map[string]interface{})
            
            items = append(items, InvoiceItem{
                Description: itemMap["product_name"].(string),
                Quantity:    itemMap["quantity"].(float64),
                UnitPrice:   itemMap["unit_price"].(float64) / 100,
                TotalPrice:  itemMap["total_price"].(float64) / 100,
                TaxRate:     0, // Will be calculated based on product type
                TaxAmount:   0,
            })
        }
    }
    
    // Add shipping if applicable
    if shipping, ok := payment.Metadata["shipping_cost"].(float64); ok && shipping > 0 {
        items = append(items, InvoiceItem{
            Description: "Shipping & Handling",
            Quantity:    1,
            UnitPrice:   shipping / 100,
            TotalPrice:  shipping / 100,
            TaxRate:     0, // Shipping might be tax-exempt
            TaxAmount:   0,
        })
    }
    
    return items
}

func (s *InvoiceService) getSubscriptionInvoiceItems(payment models.Payment) []InvoiceItem {
    planName, _ := payment.Metadata["plan_name"].(string)
    period, _ := payment.Metadata["period"].(string) // "monthly", "yearly"
    
    description := fmt.Sprintf("%s Subscription - %s", planName, period)
    
    return []InvoiceItem{{
        Description: description,
        Quantity:    1,
        UnitPrice:   float64(payment.Amount) / 100,
        TotalPrice:  float64(payment.Amount) / 100,
        TaxRate:     0,
        TaxAmount:   0,
    }}
}

func (s *InvoiceService) generateInvoiceNumber() string {
    // Format: INV-YYYY-MM-XXXXX
    now := time.Now()
    prefix := fmt.Sprintf("INV-%d-%02d-", now.Year(), now.Month())
    
    // Get count for this month
    var count int64
    startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
    
    s.db.Model(&models.Invoice{}).
        Where("created_at >= ?", startOfMonth).
        Count(&count)
    
    return fmt.Sprintf("%s%05d", prefix, count+1)
}

func (s *InvoiceService) generatePDF(data InvoiceData) (string, error) {
    // Generate HTML first
    html, err := s.generateHTML(data)
    if err != nil {
        return "", err
    }
    
    // Initialize PDF generator
    pdfg, err := wkhtmltopdf.NewPDFGenerator()
    if err != nil {
        return "", err
    }
    
    // Add page
    page := wkhtmltopdf.NewPageReader(bytes.NewReader([]byte(html)))
    page.FooterRight.Set("[page] of [topage]")
    page.FooterFontSize.Set(10)
    
    pdfg.AddPage(page)
    
    // Set PDF options
    pdfg.Dpi.Set(300)
    pdfg.PageSize.Set(wkhtmltopdf.PageSizeA4)
    pdfg.Orientation.Set(wkhtmltopdf.OrientationPortrait)
    pdfg.MarginTop.Set(15)
    pdfg.MarginBottom.Set(15)
    pdfg.MarginLeft.Set(15)
    pdfg.MarginRight.Set(15)
    
    // Create output directory if it doesn't exist
    if err := os.MkdirAll(s.outputDir, 0755); err != nil {
        return "", err
    }
    
    // Generate PDF
    filename := fmt.Sprintf("%s/%s.pdf", s.outputDir, data.InvoiceNumber)
    if err := pdfg.Create(); err != nil {
        return "", err
    }
    
    // Save PDF
    if err := pdfg.WriteFile(filename); err != nil {
        return "", err
    }
    
    // In production, upload to S3/Cloud Storage and return URL
    return filename, nil
}

func (s *InvoiceService) generateHTML(data InvoiceData) (string, error) {
    // Read template file
    templatePath := filepath.Join(s.templateDir, "invoice.html")
    tmpl, err := template.ParseFiles(templatePath)
    if err != nil {
        // Fallback to embedded template
        tmpl, err = template.New("invoice").Parse(invoiceTemplate)
        if err != nil {
            return "", err
        }
    }
    
    // Execute template
    var buf bytes.Buffer
    if err := tmpl.Execute(&buf, data); err != nil {
        return "", err
    }
    
    return buf.String(), nil
}

func (s *InvoiceService) sendInvoiceEmail(ctx context.Context, toEmail, htmlContent, pdfPath string, data InvoiceData) {
    // Send email with invoice attached
    // Integrate with your notification service
    log.Printf("Sending invoice %s to %s", data.InvoiceNumber, toEmail)
    
    // Upload PDF to cloud storage for email attachment
    pdfURL := s.uploadToCloudStorage(pdfPath)
    
    // Send via notification service
    // notificationService.SendInvoiceEmail(toEmail, data, pdfURL)
}

// Embedded HTML template as fallback
const invoiceTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Invoice {{.InvoiceNumber}}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { margin-bottom: 30px; }
        .company-info { float: left; width: 50%; }
        .invoice-info { float: right; text-align: right; width: 50%; }
        .clear { clear: both; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f4f4f4; }
        .totals { float: right; width: 300px; margin-top: 20px; }
        .totals table { width: 100%; }
        .footer { margin-top: 50px; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <div class="company-info">
            <h2>{{.Company.Name}}</h2>
            <p>{{.Company.Address}}<br>
            {{.Company.City}}, {{.Company.State}} {{.Company.Zip}}<br>
            Phone: {{.Company.Phone}}<br>
            Email: {{.Company.Email}}</p>
        </div>
        <div class="invoice-info">
            <h1>INVOICE</h1>
            <p><strong>Invoice #:</strong> {{.InvoiceNumber}}</p>
            <p><strong>Date:</strong> {{.InvoiceDate}}</p>
            <p><strong>Due Date:</strong> {{.DueDate}}</p>
        </div>
        <div class="clear"></div>
    </div>
    
    <div class="customer-info">
        <h3>Bill To:</h3>
        <p>{{.Customer.Name}}<br>
        {{.Customer.Address}}<br>
        {{.Customer.City}}, {{.Customer.State}} {{.Customer.Zip}}<br>
        {{.Customer.Country}}<br>
        Email: {{.Customer.Email}}</p>
    </div>
    
    <table>
        <thead>
            <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total</th>
            </tr>
        </thead>
        <tbody>
            {{range .Items}}
            <tr>
                <td>{{.Description}}</td>
                <td>{{.Quantity}}</td>
                <td>{{.Currency}} {{printf "%.2f" .UnitPrice}}</td>
                <td>{{.Currency}} {{printf "%.2f" .TotalPrice}}</td>
            </tr>
            {{end}}
        </tbody>
    </table>
    
    <div class="totals">
        <table>
            <tr>
                <td><strong>Subtotal:</strong></td>
                <td>{{.Currency}} {{printf "%.2f" .Subtotal}}</td>
            </tr>
            {{if gt .TaxAmount 0}}
            <tr>
                <td>Tax ({{printf "%.1f" .TaxRate}}%):</td>
                <td>{{.Currency}} {{printf "%.2f" .TaxAmount}}</td>
            </tr>
            {{end}}
            <tr>
                <td><strong>Total:</strong></td>
                <td><strong>{{.Currency}} {{printf "%.2f" .TotalAmount}}</strong></td>
            </tr>
            <tr>
                <td>Amount Paid:</td>
                <td>{{.Currency}} {{printf "%.2f" .AmountPaid}}</td>
            </tr>
            <tr>
                <td><strong>Balance Due:</strong></td>
                <td><strong>{{.Currency}} {{printf "%.2f" .BalanceDue}}</strong></td>
            </tr>
        </table>
    </div>
    
    <div class="clear"></div>
    
    <div class="payment-info">
        <p><strong>Payment Information:</strong><br>
        Method: {{.PaymentMethod}}<br>
        Transaction ID: {{.TransactionID}}<br>
        Date Paid: {{.PaymentDate}}</p>
    </div>
    
    <div class="footer">
        <p>Thank you for your business!<br>
        {{.Company.Name}} | {{.Company.Website}}<br>
        {{if .Company.TaxID}}Tax ID: {{.Company.TaxID}}{{end}}</p>
        <p><strong>Notes:</strong> {{.Notes}}</p>
        <p><strong>Terms:</strong> {{.Terms}}</p>
    </div>
</body>
</html>
`