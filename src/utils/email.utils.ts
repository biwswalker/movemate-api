import { TransportOptions, createTransport } from 'nodemailer'
import nodemailerExpressHandlebars, { HbsTransporter } from 'nodemailer-express-handlebars'
import { getGoogleOAuth2AccessToken } from '@configs/google.config'
import { join } from 'path'

export const email_sender = () => {
    const transporter = createTransport<HbsTransporter>({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
            type: 'OAuth2',
            user: process.env.GOOGLE_MAIL,
            clientId: process.env.GOOGLE_SERVICE_ID,
            clientSecret: process.env.GOOGLE_SERVICE_SECRET,
            refreshToken: process.env.GOOGLE_SERVICE_REFRESH_TOKEN,
            accessToken: getGoogleOAuth2AccessToken(),
        }
    } as TransportOptions) as HbsTransporter

    transporter.use('compile', nodemailerExpressHandlebars({
        viewEngine: {
            extname: '.hbs',
            layoutsDir: join(__dirname, '..', 'templates'),
            defaultLayout: false
        },
        viewPath: join(__dirname, '..', 'templates')
    }))

    return transporter
}