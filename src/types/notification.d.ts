type TNotificationVarient = 'info' | 'error' | 'warning' | 'success' | 'master'

interface INotification {
    userId: string
    varient: TNotificationVarient
    title: string
    message: string[]
    infoText?: string
    infoLink?: string
    errorText?: string
    errorLink?: string
    masterText?: string
    masterLink?: string
    read?: boolean
}