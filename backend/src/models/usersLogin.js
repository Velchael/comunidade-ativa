const pool = require('./connection');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const {
  KINGHOST_SMTP_HOST,
  KINGHOST_SMTP_PORT,
  KINGHOST_SMTP_USER,
  KINGHOST_SMTP_PASSWORD
} = require('../../config');

const hashPassword = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

const createUsers = async (users) => {
  const {
    username, apellido, email, password, rol, fecha_nacimiento,
    telefono, direccion, nivel_liderazgo, grupo_familiar_id,
    estado, foto_perfil
  } = users;

  const confirmationToken = crypto.randomBytes(32).toString('hex');
  const hashedPassword = await hashPassword(password);
  console.log("📥 Datos recibidos en createUsers:", users);

  try {
    console.log("🧪 Validando grupo_familiar_id:", grupo_familiar_id);
    //const [grupo] = await connection.execute(
     // 'SELECT id FROM grupos_familiares WHERE id = ?',
     // [grupo_familiar_id]
    //);
    //if (grupo.length === 0) {
     // throw new Error('Grupo familiar no encontrado');
    //}
    if (grupo_familiar_id) {
      const grupo = await pool.query(
      'SELECT id FROM grupos_familiares WHERE id = $1',
      [grupo_familiar_id]
      );
    if (grupo.rows.length === 0) {
      throw new Error('Grupo familiar no encontrado');
       }
    }
   
    // Verificar si el email ya está registrado
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.length > 0) {
      throw new Error('El correo electrónico ya está registrado');
    }

    // Insertar nuevo usuario
    await pool.query(
    `INSERT INTO users
     (username, apellido, email, password, rol, fecha_nacimiento, telefono,
      direccion, nivel_liderazgo, grupo_familiar_id, estado, foto_perfil,
      confirmation_token)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        username, apellido, email, hashedPassword, rol, fecha_nacimiento,
        telefono, direccion, nivel_liderazgo, grupo_familiar_id,
        estado, foto_perfil, confirmationToken
      ]
    );

    const transporter = nodemailer.createTransport({
      host: KINGHOST_SMTP_HOST,
      port: KINGHOST_SMTP_PORT,
      secure: true,
      auth: {
        user: KINGHOST_SMTP_USER,
        pass: KINGHOST_SMTP_PASSWORD
      }
    });

    const mailOptions = {
      from: KINGHOST_SMTP_USER,
      to: email,
      subject: 'Confirmación de registro',
      text: `Haz clic en este enlace para confirmar tu registro: http://localhost:3000/EmailConfirmation?token=${confirmationToken}`
    };

    await transporter.sendMail(mailOptions);

    return { message: 'Usuario registrado con éxito. Por favor, confirma tu correo electrónico' };
  } catch (error) {
    console.error("❌ Error en createUsers:", error);
    throw error;
  }
};

const comparePassword = async (inputPassword, storedPasswordHash) => {
  return await bcrypt.compare(inputPassword, storedPasswordHash);
};


const getUserByUsernameAndPassword = async (username, email, password) => {
  try {
    console.log("📥 Login input:", { username, email, password });
    
    // ATENÇÃO: Use pool.query() para PostgreSQL
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND email = $2 AND confirmed = TRUE',
      [username, email]
    );

    const rows = result.rows; // Para 'pg', os resultados estão em result.rows

    if (rows.length === 0) {
      console.log("⚠️ Usuario no encontrado o no confirmado");
      return null;
    } 

    const user = rows[0];
    // Se a senha do usuário vier do DB, você pode precisar ajustar o caminho.
    // Ex: user.password_hash (se você armazena um hash)
    const isPasswordValid = await comparePassword(password, user.password); 
    console.log("🔐 ¿Contraseña válida?", isPasswordValid);

    return isPasswordValid ? user : null;
  } catch (error) {
    console.error("❌ Error en getUserByUsernameAndPassword:", error);
    throw error;
  }
};



const confirmUserEmail = async (confirmationToken) => {
  try {
    if (!confirmationToken) {
      const err = new Error('Token inválido');
      err.code = 'INVALID_TOKEN';
      throw err;
    }

    const result = await pool.query(
      'SELECT * FROM users WHERE confirmation_token = $1',
      [confirmationToken]
    );

    const user = result.rows[0];

    if (!user) {
      const err = new Error('Token no válido');
      err.code = 'INVALID_TOKEN';
      throw err;
    }

    if (user.confirmed) {
      const err = new Error('Token ya utilizado');
      err.code = 'USED_TOKEN';
      throw err;
    }

    await pool.query(
      'UPDATE users SET confirmed = TRUE, confirmation_token = NULL WHERE id = $1',
      [user.id]
    );

    return { message: 'Correo electrónico confirmado con éxito' };
  } catch (error) {
    throw error;
  }
};


module.exports = {
  createUsers,
  getUserByUsernameAndPassword,
  confirmUserEmail
};
