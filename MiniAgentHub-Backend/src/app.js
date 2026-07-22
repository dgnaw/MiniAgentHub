process.on('uncaughtException', err => {
    console.error('UNCAUGHT EXCEPTION! Shutting down...');
    console.error(err.name, err.message);
    process.exit(1);
});

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const { sequelize, connectDB } = require('./config/database');
require('./config/redis');
require('./models'); 

const authRoutes = require('./routes/authRoutes');
const groupRoutes = require('./routes/groupRoutes');
const userRoutes = require('./routes/userRoutes');
const aiRoutes = require('./routes/aiRoutes');
const chatRoutes = require('./routes/chatRoutes');
const path = require('path');
const { i18next, middleware } = require('./config/i18n');
const { authenticateToken } = require('./middleware/authMiddleware');
const errorHandler = require('./middleware/errorHandler');
    
const app = express();
app.use(cors({
    origin: function (origin, callback) {
        const allowedOrigin = process.env.FRONTEND_URL;
        if (!origin || origin === allowedOrigin) {
            callback(null, true);
        } else {
            console.error(`[CORS Error] Blocked request from unauthorized origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(cookieParser());

app.use(express.json());
app.use(middleware.handle(i18next));

// Áp dụng middleware kiểm tra token toàn cục
app.use(authenticateToken);

app.use('/api/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api', authRoutes);
app.use('/api', groupRoutes);
app.use('/api', userRoutes);
app.use('/api', aiRoutes);
app.use('/api', chatRoutes);

// Bắt lỗi toàn cục
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await connectDB();
        
        await sequelize.sync();
        
        const server = app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
            if (process.env.USE_REDIS !== 'false') {
                require('./workers/emailWorker'); // Start BullMQ worker
            }
        });

        process.on('unhandledRejection', err => {
            console.error('UNHANDLED REJECTION! Shutting down...');
            console.error(err.name, err.message);
            server.close(() => {
                process.exit(1);
            });
        });
    } catch (error) {
        console.error('Critical error starting server:', error);
        process.exit(1); 
    }
};

startServer();