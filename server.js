require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const admin = require('firebase-admin');
const cors = require('cors');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
app.use(cors());
app.use(express.json());

// 🔐 Credenciales de Google Drive
const auth = new google.auth.GoogleAuth({
  credentials: {
    type: 'service_account',
    project_id: process.env.GOOGLE_PROJECT_ID,
    private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_x509_cert_url: process.env.GOOGLE_CLIENT_CERT_URL,
  },
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });
const TARGET_FOLDER_ID = process.env.TARGET_FOLDER_ID;

// 🔥 Inicializa Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.GOOGLE_PROJECT_ID,
    privateKey: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
  }),
});
const db = admin.firestore();

// 📤 Endpoint para subir archivo
app.post('/api/drive/upload', upload.single('file'), async (req, res) => {
  try {
    const { originalname, buffer } = req.file;
    const { nombre, grupo } = req.body;

    const response = await drive.files.create({
      requestBody: {
        name: originalname,
        parents: [TARGET_FOLDER_ID],
      },
      media: {
        mimeType: req.file.mimetype,
        body: Buffer.from(buffer),
      },
    });

    const fileId = response.data.id;

    await drive.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    const publicUrl = `https://drive.google.com/file/d/${fileId}/view`;

    await db.collection('archivos').add({
      nombre,
      grupo,
      url: publicUrl,
      fecha: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({ url: publicUrl });
  } catch (error) {
    console.error('Error al subir archivo:', error);
    res.status(500).json({ error: 'Error al subir archivo' });
  }
});

// 🚀 Inicia el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
