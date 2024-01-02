import { OAuth2Client } from 'google-auth-library'
import { google } from 'googleapis'

let oAuth2Client: OAuth2Client | null = null

export default function initialGoogleOAuth() {

    oAuth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_SERVICE_ID,
        process.env.GOOGLE_SERVICE_SECRET
    )
    oAuth2Client.setCredentials({ refresh_token: process.env.GOOGLE_SERVICE_REFRESH_TOKEN })
}


export async function getGoogleOAuth2AccessToken() {
    if (oAuth2Client) {
        const accessToken = oAuth2Client.getAccessToken()
        return accessToken
    }
    return ''
}
