import express from 'express';
import multer, { Multer } from 'multer';
import { createWorker } from 'tesseract.js';

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const PORT = process.env.PORT || 5000;

const storage = multer.memoryStorage();
const upload = multer({
  storage,
}).array('image', 3);

const worker = createWorker({
  langPath: './tessdata',
});

app.post('/upload', async (req, res) => {
  await upload(req, res, async (err: any) => {
    if (err) {
      return res.status(500).send('Something went wrong');
    }
    try {
      const workerInstance = await worker;
      await workerInstance.load();
      await workerInstance.loadLanguage('por');
      await workerInstance.initialize('por');

      if (!Array.isArray(req.files) || req.files.length !== 1) {
        return res.status(400).send('Please upload a single image');
      }

      const file = req.files[0];
      const image = file.buffer;
      
      const { data } = await workerInstance.recognize(image);
      const voucherText = data.text;

      const regexID = /AOO\d{11}/;
      const matchID = voucherText.match(regexID);
      const regexTransaction = /TRANSACÇÃO: (\d{5})/;
      const matchTransaction = voucherText.match(regexTransaction);

      if (matchID && matchID[0] && matchTransaction && matchTransaction[0]) {
        const [, code] = matchTransaction[0].split('TRANSACÇÃO: ');
        const voucherId = matchID[0];
        return res.json({
          success: true,
          id: voucherId,
          code: Number(code),
        });
      }

      return res.status(404).json({
        success: false,
        message: 'Unable to read image or find transaction code and ID',
      });
    } catch (error) {
      console.error('Error during OCR:', error);
      return res.status(500).send('Something went wrong');
    }
  });
});

app.listen(PORT, () => {
  console.log('Server running on port', PORT);
});
