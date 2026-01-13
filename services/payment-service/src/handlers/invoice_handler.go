package handlers

import (
    "net/http"
    
    "github.com/gin-gonic/gin"
    "github.com/google/uuid"
)

type InvoiceHandler struct {
    invoiceService *services.InvoiceService
}

func (h *InvoiceHandler) GetInvoice(c *gin.Context) {
    invoiceID := c.Param("id")
    
    var invoice models.Invoice
    if err := h.invoiceService.db.Where("id = ?", invoiceID).First(&invoice).Error; err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "Invoice not found"})
        return
    }
    
    c.JSON(http.StatusOK, invoice)
}

func (h *InvoiceHandler) GetUserInvoices(c *gin.Context) {
    userID := c.GetString("user_id")
    
    var invoices []models.Invoice
    if err := h.invoiceService.db.
        Where("user_id = ?", userID).
        Order("created_at DESC").
        Find(&invoices).Error; err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch invoices"})
        return
    }
    
    c.JSON(http.StatusOK, gin.H{"invoices": invoices})
}

func (h *InvoiceHandler) DownloadInvoice(c *gin.Context) {
    invoiceID := c.Param("id")
    
    var invoice models.Invoice
    if err := h.invoiceService.db.Where("id = ?", invoiceID).First(&invoice).Error; err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "Invoice not found"})
        return
    }
    
    // Check if user has permission
    userID := c.GetString("user_id")
    if invoice.UserID != userID && !isAdmin(c) {
        c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
        return
    }
    
    // Serve PDF file
    c.File(invoice.PDFURL)
}

func (h *InvoiceHandler) ResendInvoice(c *gin.Context) {
    invoiceID := c.Param("id")
    
    var invoice models.Invoice
    if err := h.invoiceService.db.Where("id = ?", invoiceID).First(&invoice).Error; err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "Invoice not found"})
        return
    }
    
    // Get associated payment
    var payment models.Payment
    if err := h.invoiceService.db.Where("id = ?", invoice.PaymentID).First(&payment).Error; err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Payment not found"})
        return
    }
    
    // Regenerate and resend invoice
    newInvoice, err := h.invoiceService.GenerateInvoice(c.Request.Context(), payment)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to resend invoice"})
        return
    }
    
    c.JSON(http.StatusOK, gin.H{
        "message": "Invoice resent successfully",
        "invoice": newInvoice,
    })
}