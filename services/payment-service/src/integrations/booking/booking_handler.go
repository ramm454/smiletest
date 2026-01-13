package booking

import (
    "context"
    "fmt"
    "log"
    "time"
    
    "payment-service/models"
    "payment-service/services/notification"
)

type BookingPaymentHandler struct {
    bookingClient       *BookingServiceClient
    notificationService *notification.NotificationService
    db                  interface{} // Your database interface
}

func NewBookingPaymentHandler(bookingClient *BookingServiceClient, notificationService *notification.NotificationService, db interface{}) *BookingPaymentHandler {
    return &BookingPaymentHandler{
        bookingClient:       bookingClient,
        notificationService: notificationService,
        db:                  db,
    }
}

// HandleBookingPayment processes payment for a booking
func (h *BookingPaymentHandler) HandleBookingPayment(ctx context.Context, payment models.Payment) error {
    log.Printf("Processing booking payment: %s for booking: %s", payment.ID, payment.BookingID)
    
    // Validate payment is for a booking
    if payment.BookingID == "" {
        return fmt.Errorf("payment %s is not associated with a booking", payment.ID)
    }
    
    // Get booking details
    booking, err := h.bookingClient.GetBooking(ctx, payment.BookingID)
    if err != nil {
        return fmt.Errorf("failed to get booking: %w", err)
    }
    
    // Update booking payment status based on payment status
    switch payment.Status {
    case "succeeded", "captured":
        return h.handleSuccessfulBookingPayment(ctx, payment, booking)
    case "failed", "canceled":
        return h.handleFailedBookingPayment(ctx, payment, booking)
    case "refunded":
        return h.handleRefundedBookingPayment(ctx, payment, booking)
    case "pending", "processing":
        return h.handlePendingBookingPayment(ctx, payment, booking)
    default:
        return fmt.Errorf("unknown payment status: %s", payment.Status)
    }
}

func (h *BookingPaymentHandler) handleSuccessfulBookingPayment(ctx context.Context, payment models.Payment, booking *Booking) error {
    log.Printf("Booking payment successful: %s for booking: %s", payment.ID, booking.ID)
    
    // Update booking payment status
    updateReq := UpdateBookingPaymentRequest{
        PaymentID:     payment.ID,
        PaymentStatus: "completed",
        Gateway:       payment.Gateway,
        TransactionID: payment.GatewayPaymentID,
    }
    
    if err := h.bookingClient.UpdateBookingPaymentStatus(ctx, booking.ID, updateReq); err != nil {
        return fmt.Errorf("failed to update booking payment status: %w", err)
    }
    
    // Send confirmation notifications
    go h.sendBookingConfirmationNotifications(ctx, payment, booking)
    
    // Update instructor availability/calendar if needed
    go h.updateInstructorSchedule(ctx, booking)
    
    // Send welcome email with class details
    go h.sendBookingConfirmationEmail(ctx, booking)
    
    return nil
}

func (h *BookingPaymentHandler) handleFailedBookingPayment(ctx context.Context, payment models.Payment, booking *Booking) error {
    log.Printf("Booking payment failed: %s for booking: %s", payment.ID, booking.ID)
    
    // Update booking payment status
    updateReq := UpdateBookingPaymentRequest{
        PaymentID:     payment.ID,
        PaymentStatus: "failed",
        Gateway:       payment.Gateway,
        TransactionID: payment.GatewayPaymentID,
    }
    
    if err := h.bookingClient.UpdateBookingPaymentStatus(ctx, booking.ID, updateReq); err != nil {
        return fmt.Errorf("failed to update booking payment status: %w", err)
    }
    
    // Send failure notification
    if h.notificationService != nil {
        notification := notification.Notification{
            UserID:  booking.UserID,
            Type:    "booking_payment_failed",
            Title:   "Payment Failed for Yoga Booking",
            Message: fmt.Sprintf("Payment for your booking on %s failed. Please try again.", 
                booking.StartTime.Format("Jan 2, 2006 3:04 PM")),
            Data: map[string]interface{}{
                "booking_id":   booking.ID,
                "class_id":     booking.ClassID,
                "start_time":   booking.StartTime,
                "amount":       booking.Amount,
                "currency":     booking.Currency,
            },
        }
        h.notificationService.Send(ctx, notification)
    }
    
    return nil
}

func (h *BookingPaymentHandler) handleRefundedBookingPayment(ctx context.Context, payment models.Payment, booking *Booking) error {
    log.Printf("Booking payment refunded: %s for booking: %s", payment.ID, booking.ID)
    
    // Update booking payment status
    updateReq := UpdateBookingPaymentRequest{
        PaymentID:     payment.ID,
        PaymentStatus: "refunded",
        Gateway:       payment.Gateway,
        TransactionID: payment.GatewayPaymentID,
    }
    
    if err := h.bookingClient.UpdateBookingPaymentStatus(ctx, booking.ID, updateReq); err != nil {
        return fmt.Errorf("failed to update booking payment status: %w", err)
    }
    
    // Cancel the booking
    if err := h.bookingClient.CancelBooking(ctx, booking.ID, "Payment refunded"); err != nil {
        log.Printf("Failed to cancel booking after refund: %v", err)
    }
    
    // Send refund notification
    if h.notificationService != nil {
        notification := notification.Notification{
            UserID:  booking.UserID,
            Type:    "booking_refunded",
            Title:   "Booking Refund Processed",
            Message: fmt.Sprintf("Your refund for booking on %s has been processed.", 
                booking.StartTime.Format("Jan 2, 2006 3:04 PM")),
            Data: map[string]interface{}{
                "booking_id":   booking.ID,
                "class_id":     booking.ClassID,
                "refund_amount": payment.Amount,
                "currency":     payment.Currency,
            },
        }
        h.notificationService.Send(ctx, notification)
    }
    
    return nil
}

func (h *BookingPaymentHandler) handlePendingBookingPayment(ctx context.Context, payment models.Payment, booking *Booking) error {
    log.Printf("Booking payment pending: %s for booking: %s", payment.ID, booking.ID)
    
    // Update booking payment status
    updateReq := UpdateBookingPaymentRequest{
        PaymentID:     payment.ID,
        PaymentStatus: "processing",
        Gateway:       payment.Gateway,
        TransactionID: payment.GatewayPaymentID,
    }
    
    if err := h.bookingClient.UpdateBookingPaymentStatus(ctx, booking.ID, updateReq); err != nil {
        return fmt.Errorf("failed to update booking payment status: %w", err)
    }
    
    return nil
}

func (h *BookingPaymentHandler) sendBookingConfirmationNotifications(ctx context.Context, payment models.Payment, booking *Booking) {
    // Send to user
    if h.notificationService != nil {
        userNotification := notification.Notification{
            UserID:  booking.UserID,
            Type:    "booking_confirmed",
            Title:   "Yoga Booking Confirmed! 🎉",
            Message: fmt.Sprintf("Your booking for %s on %s is confirmed. See you there!", 
                booking.ClassID, booking.StartTime.Format("Jan 2, 2006 3:04 PM")),
            Data: map[string]interface{}{
                "booking_id":   booking.ID,
                "class_id":     booking.ClassID,
                "instructor_id": booking.InstructorID,
                "start_time":   booking.StartTime,
                "end_time":     booking.EndTime,
                "location":     booking.Metadata["location"],
                "notes":        booking.Notes,
            },
        }
        h.notificationService.Send(ctx, userNotification)
    }
    
    // Send to instructor (if instructor notification service exists)
    // You would need an instructor notification service
}

func (h *BookingPaymentHandler) updateInstructorSchedule(ctx context.Context, booking *Booking) {
    // Update instructor's schedule/calendar
    // This would integrate with your instructor service
    log.Printf("Would update instructor %s schedule for booking %s", 
        booking.InstructorID, booking.ID)
}

func (h *BookingPaymentHandler) sendBookingConfirmationEmail(ctx context.Context, booking *Booking) {
    // Send email with booking details, calendar invite, etc.
    log.Printf("Would send confirmation email for booking %s", booking.ID)
}