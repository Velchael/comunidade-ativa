const pool = require('../db/pool');

exports.getAllTasks = async (req, res) => {
  const { frecuencia } = req.query;
  try {
    let query = 'SELECT * FROM tasks';
    let values = [];

    if (frecuencia) {
      query += ' WHERE frequency = $1';
      values.push(frecuencia);
    }

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getTaskById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Tarea no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createTask = async (req, res) => {
  const { title, description, frequency } = req.body;
  const email = req.user.email;
  try {
    const creator = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    const userId = creator.rows[0].id;

    const result = await pool.query(
      `INSERT INTO tasks (title, description, frequency, created_by) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [title, description, frequency, userId]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateTask = async (req, res) => {
  const { id } = req.params;
  const { title, description, frequency } = req.body;
  try {
    const result = await pool.query(
      `UPDATE tasks SET title=$1, description=$2, frequency=$3, updated_at=NOW() WHERE id=$4 RETURNING *`,
      [title, description, frequency, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Tarea no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteTask = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM tasks WHERE id=$1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Tarea no encontrada' });
    res.json({ message: 'Tarea eliminada', task: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
