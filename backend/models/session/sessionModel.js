const db = require('../../config/db');

const Session = {
  async create({ user_id, login_time, ip, user_agent }) {
    const query = `
      INSERT INTO user_sessions (user_id, login_time, ip, user_agent)
      VALUES (?, ?, ?, ?)
    `;
    const [result] = await db.query(query, [user_id, login_time, ip, user_agent]);
    return result.insertId;
  },

  async close(session_id, logout_time, session_time) {
    const query = `
      UPDATE user_sessions
      SET logout_time = ?, session_time = ?
      WHERE id = ?
    `;
    await db.query(query, [logout_time, session_time, session_id]);
  },

  async getActiveSession(user_id) {
    const query = `
      SELECT id, user_id, login_time, ip, user_agent
      FROM user_sessions
      WHERE user_id = ? AND logout_time IS NULL
      ORDER BY login_time DESC
      LIMIT 1
    `;
    const [rows] = await db.query(query, [user_id]);
    return rows[0] || null;
  }
};

module.exports = Session;