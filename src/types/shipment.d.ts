type TIssueType = 'DELAY' | 'DAMAGE' | 'MISSING' | 'OTHER'
type TStepStatus = 'idle' | 'progressing' | 'done' | 'expire' | 'cancelled'
type TStepDefinition = 'CREATED' | 'CASH_VERIFY' | 'DRIVER_ACCEPTED' | 'CONFIRM_DATETIME' | 'ARRIVAL_PICKUP_LOCATION' | 'PICKUP' | 'ARRIVAL_DROPOFF' | 'DROPOFF' | 'POD' | 'FINISH' | 'REJECTED_PAYMENT' | 'REFUND'
type TPaymentRejectionReason = 'insufficient_funds' | 'unable_verify_evidence' | 'other'

type TBillingStatus = 'current' | 'overdue' | 'suspended' | 'paid'
type TBillingPaymentStatus = 'paid' | 'pending' | 'failed'
