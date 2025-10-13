// PostgreSQL connection
const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "Balise-RCo",
  password: "LoremIpsum",
  port: 5432,
});

module.exports = pool;