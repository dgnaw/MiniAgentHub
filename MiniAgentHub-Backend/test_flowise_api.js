const { Sequelize } = require('sequelize');
const jwt = require('jsonwebtoken');

const sequelize = new Sequelize('postgres://postgres:dogianam2005@localhost:5432/mini_agenthub_db');
const secret = '2206b1ce85c89c76eb18e60e061459d3920ef62ccfea8ff783f44e3014e726e99183b88cb87ba845ff5aeec9944fae5af0d895b39f6cb591aaa20189e2f6ad22';

const run = async () => {
  const [users] = await sequelize.query("SELECT id FROM users WHERE email='admin@company.com'");
  if (!users.length) return console.log('User not found');
  const userId = users[0].id;
  const token = jwt.sign({ id: userId, role: 'admin' }, secret, { expiresIn: '1h' });
  
  console.log('Got token. Fetching /api/chat...');
  const res = await fetch('http://localhost:5000/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `agentHub_token=${token}`
    },
    body: JSON.stringify({ message: "hi", model: "Data Analyst" })
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    console.log("RECEIVED:", decoder.decode(value));
  }
};
run().catch(console.error);
