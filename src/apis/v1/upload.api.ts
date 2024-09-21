import { Router } from 'express'
import multer from 'multer'
import { join, extname } from 'path'
import { generateId, generateRandomNumberPattern } from '@utils/string.utils'
import { get } from 'lodash'
import { FileUploadPayload } from '@payloads/file.payloads'

const upload_api = Router()

// File upload route (for REST API)
const storage = multer.diskStorage({
  destination: join(__dirname, '..', '..', '..', 'uploads'),
  filename: async (_, file, cb) => {
    const generated_filename = await generateId(`${generateRandomNumberPattern('MMSOURCE######')}-`, 'upload')
    const final_filename = `${generated_filename}${extname(file.originalname)}`
    cb(null, final_filename)
  },
})

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } })

upload_api.post('/', upload.single('file'), async (req, res) => {
  const host = req.get('host')
  var fullUrl = req.protocol + '://' + host

  const filename = get(req, 'file.filename', '')
  const mimetype = get(req, 'file.mimetype', '')
  const url = `${fullUrl}/source/${filename}`
  const response: FileUploadPayload = {
    fileId: get(filename.split('.'), '0', ''),
    filename: filename,
    mimetype,
    url,
  }
  res.json(response)
})
export default upload_api
