const express = require('express');
const cors = require('cors');
const router = require('./router');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const app = express();

const allowedOrigins = [
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  'http://localhost:3001', // ✅ Agrega esto
  'http://localhost:3002',    // si usas este puerto desde navegador
  'http://localhost:3005', // 👈 Necesario para tu React en Docker
  'http://frontend', // para docker-compose
  'http://backend:3000' // ✅ necesario para docker
];

const corsOptions = {
  origin: (origin, callback) => {
    if (allowedOrigins.includes(origin) || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configura los encabezados CORS adecuados para todas las solicitudes
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

// Configura los encabezados CORS adecuados para las solicitudes OPTIONS
app.options('*', cors(corsOptions));

// Manejador de la ruta POST
app.post('/users/confirm/:token', (req, res) => {
  // Tu lógica de confirmación de correo electrónico aquí
  res.status(200).send('Email confirmado!');
});

// Monta el router en el prefijo /api
app.use('/api', router);

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Algo deu errado!!!!!!!', details: err.message });
});

module.exports = app;