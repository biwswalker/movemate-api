import { Router } from 'express'

const ping_api = Router()

ping_api.get('/', async (req, res) => {
    const host = req.get('host')
    var fullUrl = req.protocol + '://' + req.get('host');
    res.status(200).send({ api: 'ping', fullUrl })
})
export default ping_api