type TIssueType = 'DELAY' | 'DAMAGE' | 'MISSING' | 'OTHER'

type TPaymentMethod = 'cash' | 'credit'
type TShipingStatus = 'idle' | 'progressing' | 'dilivered' | 'cancelled' | 'refund' | 'expire'
type TAdminAcceptanceStatus = 'pending' | 'reach' | 'accepted' | 'rejected' | 'cancelled'
type TDriverAcceptanceStatus = 'idle' | 'pending' | 'accepted' | 'uninterested'
type TPaymentStatus = 'waiting_confirm_payment' | 'invoice' | 'billed' | 'confirm_payment' | 'paid' | 'refund' | 'refunded'
type TShipingLogStatus = 'pending' | 'inprogress' | 'complete' | 'cancelled' | 'rejected' | 'refund'

type TCriteriaStatus = 'all' | 'progress' | 'refund' | 'finish' | 'idle' | 'progressing' | 'dilivered' | 'cancelled' | 'refund' | 'expire'

type TStepStatus = 'idle' | 'progressing' | 'done' | 'expire' | 'cancelled'
type TStepDefinition = 'CREATED' | 'CASH_VERIFY' | 'DRIVER_ACCEPTED' | 'CONFIRM_DATETIME' | 'ARRIVAL_PICKUP_LOCATION' | 'PICKUP' | 'ARRIVAL_DROPOFF' | 'DROPOFF' | 'POD' | 'FINISH'

type TPaymentRejectionReason = 'insufficient_funds' | 'unable_verify_evidence' | 'other'

type TShipmentCancellationReason =
  | 'lost_item'
  | 'incomplete_info'
  | 'recipient_unavailable'
  | 'booking_issue'
  | 'vehicle_issue'
  | 'driver_cancelled'
  | 'delayed_shipment'
  | 'customer_request'
  | 'packing_error'
  | 'management_decision'
  | 'other'


