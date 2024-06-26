import { TransportOptions, createTransport } from 'nodemailer'
import nodemailerExpressHandlebars, { HbsTransporter } from 'nodemailer-express-handlebars'
import { join } from 'path'

export const email_sender = () => {
    const transporter = createTransport<HbsTransporter>({
        host: "smtpout.secureserver.net",
        secure: true,
        secureConnection: false,
        tls: {
            ciphers: 'SSLv3'
        },
        requireTLS: true,
        port: 465,
        debug: true,
        auth: {
            user: process.env.NOREPLY_EMAIL,
            pass: process.env.NOREPLY_SECRET
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