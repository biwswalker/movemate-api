import { Router } from 'express'

const ping_api = Router()

ping_api.get('/', async (req, res) => {
    res.status(200).send({ api: 'ping', data: process.env })
})
export default ping_api