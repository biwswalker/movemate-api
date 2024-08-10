type TIssueType = 'DELAY' | 'DAMAGE' | 'MISSING' | 'OTHER'

type TPaymentMethod = 'cash' | 'credit'
type TShipingStatus = 'idle' | 'progressing' | 'dilivered' | 'cancelled' | 'refund' | 'expire'
type TAdminAcceptanceStatus = 'pending' | 'reach' | 'accepted' | 'rejected' | 'cancelled'
type TDriverAcceptanceStatus = 'idle' | 'pending' | 'accepted' | 'uninterested'
type TPaymentStatus = 'waiting_confirm_payment' | 'invoice' | 'billed' | 'confirm_payment' | 'paid' | 'refunded'
type TShipingLogStatus = 'pending' | 'inprogress' | 'complete' | 'cancelled' | 'rejected' | 'refund'

type TCriteriaStatus = 'all' | 'progress' | 'refund' | 'finish'

type TStepStatus = 'idle' | 'progressing' | 'done' | 'expire' | 'cancelled'
type TStepDefinition = 'CREATED' | 'CASH_VERIFY' | 'DRIVER_ACCEPTED' | 'CONFIRM_DATETIME' | 'ARRIVAL_PICKUP_LOCATION' | 'PICKUP' | 'ARRIVAL_DROPOFF' | 'DROPOFF' | 'POD' | 'FINISH'