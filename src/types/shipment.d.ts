type TIssueType = 'DELAY' | 'DAMAGE' | 'MISSING' | 'OTHER'

type TPaymentMethod = 'cash' | 'credit'
type TShipingStatus = 'idle' | 'progressing' | 'dilivered' | 'cancelled' | 'refund' | 'expire'
type TAdminAcceptanceStatus = 'pending' | 'reach' | 'accepted' | 'rejected' | 'cancelled'
type TDriverAcceptanceStatus = 'idle' | 'pending' | 'accepted' | 'uninterested'
type TPaymentStatus = 'waiting_confirm_payment' | 'invoice' | 'billed' | 'confirm_payment' | 'paid' | 'refunded'
type TShipingLogStatus = 'pending' | 'inprogress' | 'complete' | 'cancelled' | 'rejected' | 'refund'

type TCriteriaStatus = 'all' | 'progress' | 'refund' | 'finish'