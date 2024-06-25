const mysql = require('mysql2')
require('dotenv').config()

const connection = mysql.createConnection({
    host: 'localhost',//127.0.0.1
    user: 'root',
    password: 'KienBT3',
    database: 'crawl_udemy'
  });

  connection.connect((err) => {
    if (err) {
      console.error('Error connecting to MySQL: ', err);
      return;
    }
    console.log('Connected to MySQL');
  });
  
  module.exports = connection;