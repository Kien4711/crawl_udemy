const crypto = require('crypto');

function generateJobId() {
  const currentTimestamp = new Date().toISOString().replace(/[-T:.Z]/g, '');
  const randomString = crypto.randomBytes(3).toString('hex').toUpperCase();
  return currentTimestamp + randomString;
}

async function saveLog(connection, jobId, status, message, logType, detail) {
  const query = 'INSERT INTO log (job_id, status, message, log_type, detail) VALUES (?, ?, ?, ?, ?)';
  const values = [jobId, status, message, logType, detail ? JSON.stringify(detail) : null];

  return new Promise((resolve, reject) => {
    connection.query(query, values, (error, results) => {
      if (error) return reject(error);
      resolve(results);
    });
  });
}

module.exports = { generateJobId, saveLog };
