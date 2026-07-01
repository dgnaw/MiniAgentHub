const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { sequelize, connectDB } = require('./config/database');
require('./models'); 

const authRoutes = require('./routes/authRoutes');
const groupRoutes = require('./routes/groupRoutes');
const userRoutes = require('./routes/userRoutes');
const aiRoutes = require('./routes/aiRoutes');
const chatRoutes = require('./routes/chatRoutes');
const path = require('path');
const { i18next, middleware } = require('./config/i18n');
const { authenticateToken } = require('./middleware/authMiddleware');
    
const app = express();
app.use(cors());

app.use('/api/uploads', express.static(path.join(__dirname, '../uploads')));

app.use(express.json());
app.use(middleware.handle(i18next));

// Áp dụng middleware kiểm tra token toàn cục
app.use(authenticateToken);

app.use('/api', authRoutes);
app.use('/api', groupRoutes);
app.use('/api', userRoutes);
app.use('/api', aiRoutes);
app.use('/api', chatRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, async() => {
    console.log(`Server dang chay tai cong ${PORT}`);
    await connectDB();

    try {
        await sequelize.sync({ alter: true });
    } catch (error) {
        console.error('Lỗi khi sync database:', error);
    }
});