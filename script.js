
// Add this at the top of your script.js file (replace existing database connection)

// Load environment variables
require('dotenv').config();

// Database connection - Railway friendly
let db;
async function initDatabase() {
    try {
        // Railway provides these environment variables automatically
        const dbConfig = {
            host: process.env.MYSQL_HOST || process.env.DB_HOST || 'localhost',
            port: process.env.MYSQL_PORT || process.env.DB_PORT || 3306,
            user: process.env.MYSQL_USERNAME || process.env.DB_USER || 'root',
            password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || 'hanssen75',
            database: process.env.MYSQL_DATABASE || process.env.DB_NAME || 'railway',
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        };

        db = await mysql.createConnection(dbConfig);
        
        console.log('✅ Connected to MySQL database');
        console.log(`📍 Database: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
        
        // Create tables if they don't exist
        await createTables();
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        process.exit(1);
    }
}

// Updated config object for Railway
const config = {
    server: {
        port: process.env.PORT || 3000,
        allowedOrigins: process.env.ALLOWED_ORIGINS 
            ? process.env.ALLOWED_ORIGINS.split(',')
            : [
                'http://localhost:3000',
                'http://localhost:8080',
                'https://unmatchedtasks.online',
                'https://www.unmatchedtasks.online'
            ]
    },
    jwt: {
        secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    },
    discord: {
        botToken: process.env.DISCORD_BOT_TOKEN || 'YOUR_DISCORD_BOT_TOKEN_HERE',
        clientId: process.env.DISCORD_CLIENT_ID || 'YOUR_DISCORD_CLIENT_ID_HERE',
        guildId: process.env.DISCORD_GUILD_ID || 'YOUR_DISCORD_SERVER_ID_HERE',
        channelId: process.env.DISCORD_CHANNEL_ID || 'YOUR_DISCORD_CHANNEL_ID_FOR_NOTIFICATIONS'
    }
};

const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('./config.json');

const app = express();
const PORT = config.server.port || 3000;

// Middleware
app.use(cors({
    origin: config.server.allowedOrigins,
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static('uploads'));

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image and video files are allowed'));
        }
    }
});

// Database connection
let db;
async function initDatabase() {
    try {
        db = await mysql.createConnection({
            host: config.database.host,
            user: config.database.user,
            password: config.database.password,
            database: config.database.name,
            port: config.database.port
        });
        
        console.log('✅ Connected to MySQL database');
        
        // Create tables if they don't exist
        await createTables();
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        process.exit(1);
    }
}

// Create database tables
async function createTables() {
    const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            discord_id VARCHAR(20) UNIQUE,
            discord_username VARCHAR(50),
            role ENUM('none', 'staff', 'developer', 'admin') DEFAULT 'none',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `;

    const createTasksTable = `
        CREATE TABLE IF NOT EXISTS tasks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            area ENUM('script', 'cars', 'clothing', 'mlo') NOT NULL,
            description TEXT NOT NULL,
            assignee_id INT,
            evidence_url VARCHAR(500),
            created_by_id INT NOT NULL,
            status ENUM('pending', 'progress', 'completed', 'rejected') DEFAULT 'pending',
            rejection_reason TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `;

    await db.execute(createUsersTable);
    await db.execute(createTasksTable);
    console.log('✅ Database tables created/verified');
}

// Discord Bot Setup
const discordClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages
    ]
});

discordClient.once('ready', async () => {
    console.log('✅ Discord bot is ready!');
    await registerSlashCommands();
});

// Handle slash commands
discordClient.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {
        switch (commandName) {
            case 'create-task':
                await handleCreateTaskCommand(interaction);
                break;
            case 'my-tasks':
                await handleMyTasksCommand(interaction);
                break;
            case 'task-status':
                await handleTaskStatusCommand(interaction);
                break;
            case 'assign-task':
                await handleAssignTaskCommand(interaction);
                break;
            case 'task-info':
                await handleTaskInfoCommand(interaction);
                break;
            case 'help':
                await handleHelpCommand(interaction);
                break;
        }
    } catch (error) {
        console.error('Command error:', error);
        await interaction.reply({ content: 'An error occurred while processing your command.', ephemeral: true });
    }
});

// Register slash commands
async function registerSlashCommands() {
    const commands = [
        {
            name: 'create-task',
            description: 'Create a new development task',
            options: [
                {
                    name: 'title',
                    type: 3, // STRING
                    description: 'Task title',
                    required: true
                },
                {
                    name: 'area',
                    type: 3, // STRING
                    description: 'Task area',
                    required: true,
                    choices: [
                        { name: 'Script', value: 'script' },
                        { name: 'Cars', value: 'cars' },
                        { name: 'Clothing', value: 'clothing' },
                        { name: 'MLO', value: 'mlo' }
                    ]
                },
                {
                    name: 'description',
                    type: 3, // STRING
                    description: 'Detailed task description',
                    required: true
                },
                {
                    name: 'assign-to',
                    type: 6, // USER
                    description: 'Assign to a developer (optional)',
                    required: false
                }
            ]
        },
        {
            name: 'my-tasks',
            description: 'View your assigned tasks'
        },
        {
            name: 'task-status',
            description: 'Update task status',
            options: [
                {
                    name: 'task-id',
                    type: 4, // INTEGER
                    description: 'Task ID number',
                    required: true
                },
                {
                    name: 'status',
                    type: 3, // STRING
                    description: 'New status',
                    required: true,
                    choices: [
                        { name: 'In Progress', value: 'progress' },
                        { name: 'Completed', value: 'completed' },
                        { name: 'Rejected', value: 'rejected' }
                    ]
                },
                {
                    name: 'reason',
                    type: 3, // STRING
                    description: 'Rejection reason (required for rejected status)',
                    required: false
                }
            ]
        },
        {
            name: 'assign-task',
            description: 'Assign a task to a developer (Admin/Developer only)',
            options: [
                {
                    name: 'task-id',
                    type: 4, // INTEGER
                    description: 'Task ID number',
                    required: true
                },
                {
                    name: 'developer',
                    type: 6, // USER
                    description: 'Developer to assign to',
                    required: true
                }
            ]
        },
        {
            name: 'task-info',
            description: 'Get detailed information about a task',
            options: [
                {
                    name: 'task-id',
                    type: 4, // INTEGER
                    description: 'Task ID number',
                    required: true
                }
            ]
        },
        {
            name: 'help',
            description: 'Show available commands and usage'
        }
    ];

    try {
        await discordClient.application.commands.set(commands);
        console.log('✅ Discord slash commands registered!');
    } catch (error) {
        console.error('Failed to register commands:', error);
    }
}

// Command handlers
async function handleCreateTaskCommand(interaction) {
    try {
        // Check if user has permission (must be linked to website account)
        const discordId = interaction.user.id;
        const [users] = await db.execute('SELECT * FROM users WHERE discord_id = ?', [discordId]);
        
        if (users.length === 0) {
            return await interaction.reply({
                content: '❌ You must link your Discord account to the website first!\nRegister at the website and contact an admin to link your Discord.',
                ephemeral: true
            });
        }

        const user = users[0];
        if (!['staff', 'developer', 'admin'].includes(user.role)) {
            return await interaction.reply({
                content: '❌ You need Staff, Developer, or Admin role to create tasks!',
                ephemeral: true
            });
        }

        const title = interaction.options.getString('title');
        const area = interaction.options.getString('area');
        const description = interaction.options.getString('description');
        const assignToUser = interaction.options.getUser('assign-to');

        let assigneeId = null;
        if (assignToUser) {
            const [assignees] = await db.execute('SELECT * FROM users WHERE discord_id = ? AND role IN ("developer", "admin")', [assignToUser.id]);
            if (assignees.length > 0) {
                assigneeId = assignees[0].id;
            }
        }

        // Create task in database
        const [result] = await db.execute(
            'INSERT INTO tasks (title, area, description, assignee_id, created_by_id) VALUES (?, ?, ?, ?, ?)',
            [title, area, description, assigneeId, user.id]
        );

        // Get the created task with user details
        const [tasks] = await db.execute(`
            SELECT t.*, 
                   u1.username as created_by_username,
                   u1.discord_id as creator_discord_id,
                   u2.username as assignee_username,
                   u2.discord_id as assignee_discord_id
            FROM tasks t
            LEFT JOIN users u1 ON t.created_by_id = u1.id  
            LEFT JOIN users u2 ON t.assignee_id = u2.id
            WHERE t.id = ?
        `, [result.insertId]);

        const task = tasks[0];

        // Send notifications
        await sendTaskNotification(task, 'new');
        
        if (task.assignee_discord_id) {
            await sendAssignmentDM(task.assignee_discord_id, task);
        }

        const embed = new EmbedBuilder()
            .setTitle('✅ Task Created Successfully!')
            .setColor(0x00FF00)
            .addFields(
                { name: 'Task ID', value: `#${task.id}`, inline: true },
                { name: 'Title', value: title, inline: true },
                { name: 'Area', value: area.toUpperCase(), inline: true },
                { name: 'Assigned to', value: task.assignee_username || 'Unassigned', inline: true }
            );

        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        console.error('Create task command error:', error);
        await interaction.reply({ content: 'Failed to create task. Please try again.', ephemeral: true });
    }
}

async function handleMyTasksCommand(interaction) {
    try {
        const discordId = interaction.user.id;
        const [users] = await db.execute('SELECT * FROM users WHERE discord_id = ?', [discordId]);
        
        if (users.length === 0) {
            return await interaction.reply({
                content: '❌ You must link your Discord account to the website first!',
                ephemeral: true
            });
        }

        const user = users[0];
        
        // Get user's assigned tasks
        const [tasks] = await db.execute(`
            SELECT t.*, u.username as created_by_username
            FROM tasks t
            LEFT JOIN users u ON t.created_by_id = u.id
            WHERE t.assignee_id = ? AND t.status IN ('pending', 'progress')
            ORDER BY t.created_at DESC
            LIMIT 10
        `, [user.id]);

        if (tasks.length === 0) {
            return await interaction.reply({
                content: '📋 You have no active tasks assigned to you.',
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(`📋 Your Active Tasks (${tasks.length})`)
            .setColor(0x5865F2)
            .setDescription(tasks.map(task => 
                `**#${task.id}** ${task.title}\n` +
                `📍 ${task.area.toUpperCase()} • 🔹 ${task.status.toUpperCase()}\n` +
                `👤 Created by: ${task.created_by_username}\n`
            ).join('\n'))
            .setFooter({ text: 'Use /task-info [id] for more details' });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
        console.error('My tasks command error:', error);
        await interaction.reply({ content: 'Failed to load your tasks.', ephemeral: true });
    }
}

async function handleTaskStatusCommand(interaction) {
    try {
        const discordId = interaction.user.id;
        const taskId = interaction.options.getInteger('task-id');
        const status = interaction.options.getString('status');
        const reason = interaction.options.getString('reason');

        // Check if user exists and has permission
        const [users] = await db.execute('SELECT * FROM users WHERE discord_id = ?', [discordId]);
        
        if (users.length === 0) {
            return await interaction.reply({
                content: '❌ You must link your Discord account to the website first!',
                ephemeral: true
            });
        }

        const user = users[0];
        
        // Get task details
        const [tasks] = await db.execute('SELECT * FROM tasks WHERE id = ?', [taskId]);
        
        if (tasks.length === 0) {
            return await interaction.reply({
                content: `❌ Task #${taskId} not found.`,
                ephemeral: true
            });
        }

        const task = tasks[0];

        // Check permissions
        if (user.role !== 'admin' && task.assignee_id !== user.id) {
            return await interaction.reply({
                content: '❌ You can only update tasks assigned to you!',
                ephemeral: true
            });
        }

        // Validate rejection reason
        if (status === 'rejected' && !reason) {
            return await interaction.reply({
                content: '❌ Rejection reason is required when rejecting a task!',
                ephemeral: true
            });
        }

        // Update task status
        await db.execute(
            'UPDATE tasks SET status = ?, rejection_reason = ? WHERE id = ?',
            [status, status === 'rejected' ? reason : null, taskId]
        );

        // Get updated task with user details for notifications
        const [updatedTasks] = await db.execute(`
            SELECT t.*, 
                   u1.username as created_by_username,
                   u1.discord_id as creator_discord_id,
                   u2.username as assignee_username,
                   u2.discord_id as assignee_discord_id
            FROM tasks t
            LEFT JOIN users u1 ON t.created_by_id = u1.id  
            LEFT JOIN users u2 ON t.assignee_id = u2.id
            WHERE t.id = ?
        `, [taskId]);

        const updatedTask = updatedTasks[0];

        // Send Discord notification
        await sendTaskNotification(updatedTask, status);

        const embed = new EmbedBuilder()
            .setTitle(`✅ Task #${taskId} Updated`)
            .setColor(status === 'completed' ? 0x00FF00 : status === 'rejected' ? 0xFF0000 : 0xFFFF00)
            .addFields(
                { name: 'Status', value: status.toUpperCase(), inline: true },
                { name: 'Task', value: updatedTask.title, inline: true }
            );

        if (reason) {
            embed.addFields({ name: 'Reason', value: reason });
        }

        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        console.error('Task status command error:', error);
        await interaction.reply({ content: 'Failed to update task status.', ephemeral: true });
    }
}

async function handleAssignTaskCommand(interaction) {
    try {
        const discordId = interaction.user.id;
        const taskId = interaction.options.getInteger('task-id');
        const assignToUser = interaction.options.getUser('developer');

        // Check if user has permission
        const [users] = await db.execute('SELECT * FROM users WHERE discord_id = ?', [discordId]);
        
        if (users.length === 0 || !['developer', 'admin'].includes(users[0].role)) {
            return await interaction.reply({
                content: '❌ You need Developer or Admin role to assign tasks!',
                ephemeral: true
            });
        }

        // Check if assignee exists and is a developer
        const [assignees] = await db.execute('SELECT * FROM users WHERE discord_id = ? AND role IN ("developer", "admin")', [assignToUser.id]);
        
        if (assignees.length === 0) {
            return await interaction.reply({
                content: '❌ User must be linked to the website and have Developer/Admin role!',
                ephemeral: true
            });
        }

        // Check if task exists
        const [tasks] = await db.execute('SELECT * FROM tasks WHERE id = ?', [taskId]);
        
        if (tasks.length === 0) {
            return await interaction.reply({
                content: `❌ Task #${taskId} not found.`,
                ephemeral: true
            });
        }

        // Update task assignment
        await db.execute('UPDATE tasks SET assignee_id = ? WHERE id = ?', [assignees[0].id, taskId]);

        // Get updated task for notifications
        const [updatedTasks] = await db.execute(`
            SELECT t.*, 
                   u1.username as created_by_username,
                   u2.username as assignee_username,
                   u2.discord_id as assignee_discord_id
            FROM tasks t
            LEFT JOIN users u1 ON t.created_by_id = u1.id  
            LEFT JOIN users u2 ON t.assignee_id = u2.id
            WHERE t.id = ?
        `, [taskId]);

        const task = updatedTasks[0];

        // Send DM to newly assigned user
        await sendAssignmentDM(assignees[0].discord_id, task);

        const embed = new EmbedBuilder()
            .setTitle('✅ Task Assigned Successfully!')
            .setColor(0x00FF00)
            .addFields(
                { name: 'Task', value: `#${taskId} - ${task.title}`, inline: false },
                { name: 'Assigned to', value: assignees[0].username, inline: true }
            );

        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        console.error('Assign task command error:', error);
        await interaction.reply({ content: 'Failed to assign task.', ephemeral: true });
    }
}

async function handleTaskInfoCommand(interaction) {
    try {
        const taskId = interaction.options.getInteger('task-id');

        // Get task with user details
        const [tasks] = await db.execute(`
            SELECT t.*, 
                   u1.username as created_by_username,
                   u2.username as assignee_username
            FROM tasks t
            LEFT JOIN users u1 ON t.created_by_id = u1.id  
            LEFT JOIN users u2 ON t.assignee_id = u2.id
            WHERE t.id = ?
        `, [taskId]);

        if (tasks.length === 0) {
            return await interaction.reply({
                content: `❌ Task #${taskId} not found.`,
                ephemeral: true
            });
        }

        const task = tasks[0];

        const embed = new EmbedBuilder()
            .setTitle(`📋 Task #${task.id}: ${task.title}`)
            .setColor(getStatusColor(task.status))
            .addFields(
                { name: 'Status', value: task.status.toUpperCase(), inline: true },
                { name: 'Area', value: task.area.toUpperCase(), inline: true },
                { name: 'Assigned to', value: task.assignee_username || 'Unassigned', inline: true },
                { name: 'Created by', value: task.created_by_username, inline: true },
                { name: 'Created', value: new Date(task.created_at).toLocaleDateString(), inline: true },
                { name: 'Description', value: task.description.substring(0, 1000), inline: false }
            );

        if (task.rejection_reason) {
            embed.addFields({ name: 'Rejection Reason', value: task.rejection_reason, inline: false });
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
        console.error('Task info command error:', error);
        await interaction.reply({ content: 'Failed to get task information.', ephemeral: true });
    }
}

async function handleHelpCommand(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('🤖 Dev Task Manager Bot Commands')
        .setColor(0x5865F2)
        .setDescription('Available commands for managing development tasks:')
        .addFields(
            {
                name: '📋 Task Management',
                value: '`/create-task` - Create a new task\n' +
                       '`/my-tasks` - View your assigned tasks\n' +
                       '`/task-info [id]` - Get task details\n' +
                       '`/task-status [id] [status]` - Update task status',
                inline: false
            },
            {
                name: '👥 Assignment',
                value: '`/assign-task [id] [@user]` - Assign task to developer',
                inline: false
            },
            {
                name: '🔒 Permissions',
                value: '**Staff+**: Create tasks\n' +
                       '**Developer**: Manage assigned tasks\n' +
                       '**Admin**: Full access',
                inline: false
            },
            {
                name: '📝 Note',
                value: 'You must link your Discord account on the website first!',
                inline: false
            }
        )
        .setFooter({ text: 'Need help? Contact an admin!' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

function getStatusColor(status) {
    switch (status) {
        case 'completed': return 0x00FF00;
        case 'rejected': return 0xFF0000;
        case 'progress': return 0xFFFF00;
        default: return 0xFFA500;
    }
}

discordClient.login(config.discord.botToken);

// Discord notification functions
async function sendTaskNotification(task, type = 'new') {
    try {
        const channel = await discordClient.channels.fetch(config.discord.channelId);
        if (!channel) return;

        let embed;
        
        switch (type) {
            case 'new':
                embed = new EmbedBuilder()
                    .setTitle('📋 New Task Created')
                    .setColor(0x5865F2)
                    .addFields(
                        { name: 'Title', value: task.title, inline: false },
                        { name: 'Area', value: task.area.toUpperCase(), inline: true },
                        { name: 'Assigned to', value: task.assignee_username || 'Unassigned', inline: true },
                        { name: 'Created by', value: task.created_by_username, inline: true },
                        { name: 'Description', value: task.description.substring(0, 1000), inline: false }
                    )
                    .setTimestamp();
                break;
                
            case 'completed':
                embed = new EmbedBuilder()
                    .setTitle('✅ Task Completed')
                    .setColor(0x00FF00)
                    .addFields(
                        { name: 'Title', value: task.title, inline: false },
                        { name: 'Completed by', value: task.assignee_username, inline: true },
                        { name: 'Area', value: task.area.toUpperCase(), inline: true }
                    )
                    .setTimestamp();
                break;
                
            case 'rejected':
                embed = new EmbedBuilder()
                    .setTitle('❌ Task Rejected')
                    .setColor(0xFF0000)
                    .addFields(
                        { name: 'Title', value: task.title, inline: false },
                        { name: 'Rejected by', value: task.assignee_username, inline: true },
                        { name: 'Reason', value: task.rejection_reason || 'No reason provided', inline: false }
                    )
                    .setTimestamp();
                break;
                
            case 'progress':
                embed = new EmbedBuilder()
                    .setTitle('🔄 Task In Progress')
                    .setColor(0xFFFF00)
                    .addFields(
                        { name: 'Title', value: task.title, inline: false },
                        { name: 'Developer', value: task.assignee_username, inline: true },
                        { name: 'Area', value: task.area.toUpperCase(), inline: true }
                    )
                    .setTimestamp();
                break;
        }

        await channel.send({ embeds: [embed] });

        // Send mentions for completed/rejected tasks
        if (type === 'completed' && task.creator_discord_id) {
            await channel.send(`🎉 <@${task.creator_discord_id}> Your task "${task.title}" has been completed!`);
        } else if (type === 'rejected' && task.creator_discord_id) {
            await channel.send(`📢 <@${task.creator_discord_id}> Your task "${task.title}" has been rejected.`);
        }

    } catch (error) {
        console.error('Discord notification error:', error);
    }
}

async function sendAssignmentDM(discordId, task) {
    try {
        const user = await discordClient.users.fetch(discordId);
        if (user) {
            const embed = new EmbedBuilder()
                .setTitle('🔔 New Task Assignment')
                .setColor(0x5865F2)
                .addFields(
                    { name: 'Task', value: task.title, inline: false },
                    { name: 'Area', value: task.area.toUpperCase(), inline: true },
                    { name: 'Description', value: task.description.substring(0, 500), inline: false }
                )
                .setTimestamp();
                
            await user.send({ embeds: [embed] });
        }
    } catch (error) {
        console.error('DM error:', error);
    }
}

// JWT Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, config.jwt.secret, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
}

// Role checking middleware
function requireRole(roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}

// Auth Routes
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Check if user exists
        const [existingUsers] = await db.execute(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username, email]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }

        // Hash password
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Create user
        const [result] = await db.execute(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
            [username, email, passwordHash]
        );

        res.status(201).json({ 
            message: 'User created successfully. Please wait for admin approval.',
            userId: result.insertId 
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // Get user
        const [users] = await db.execute(
            'SELECT * FROM users WHERE username = ? OR email = ?',
            [username, username]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];

        // Check password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT
        const token = jwt.sign(
            { userId: user.id, username: user.username, role: user.role },
            config.jwt.secret,
            { expiresIn: config.jwt.expiresIn }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                discordId: user.discord_id,
                discordUsername: user.discord_username
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// User Routes
app.get('/api/users', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const [users] = await db.execute(
            'SELECT id, username, email, role, discord_id, discord_username, created_at FROM users ORDER BY created_at DESC'
        );
        res.json(users);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/api/users/:id/role', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!['none', 'staff', 'developer', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        await db.execute('UPDATE users SET role = ? WHERE id = ?', [role, id]);
        res.json({ message: 'Role updated successfully' });
    } catch (error) {
        console.error('Update role error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/developers', authenticateToken, async (req, res) => {
    try {
        const [developers] = await db.execute(
            'SELECT id, username FROM users WHERE role = "developer" ORDER BY username'
        );
        res.json(developers);
    } catch (error) {
        console.error('Get developers error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Task Routes
app.get('/api/tasks', authenticateToken, async (req, res) => {
    try {
        const { status, area, assignee, createdBy } = req.query;
        
        let query = `
            SELECT t.*, 
                   u1.username as created_by_username,
                   u1.discord_id as creator_discord_id,
                   u2.username as assignee_username,
                   u2.discord_id as assignee_discord_id
            FROM tasks t
            LEFT JOIN users u1 ON t.created_by_id = u1.id  
            LEFT JOIN users u2 ON t.assignee_id = u2.id
            WHERE 1=1
        `;
        
        const params = [];
        
        if (status) {
            query += ' AND t.status = ?';
            params.push(status);
        }
        
        if (area) {
            query += ' AND t.area = ?';
            params.push(area);
        }
        
        if (assignee === 'me') {
            query += ' AND t.assignee_id = ?';
            params.push(req.user.userId);
        } else if (assignee) {
            query += ' AND u2.username = ?';
            params.push(assignee);
        }
        
        if (createdBy === 'me') {
            query += ' AND t.created_by_id = ?';
            params.push(req.user.userId);
        }
        
        query += ' ORDER BY t.created_at DESC';
        
        const [tasks] = await db.execute(query, params);
        res.json(tasks);
    } catch (error) {
        console.error('Get tasks error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/tasks', authenticateToken, requireRole(['staff', 'developer', 'admin']), upload.single('evidence'), async (req, res) => {
    try {
        const { title, area, description, assigneeId } = req.body;
        
        if (!title || !area || !description) {
            return res.status(400).json({ error: 'Title, area, and description are required' });
        }

        let evidenceUrl = null;
        if (req.file) {
            evidenceUrl = `/uploads/${req.file.filename}`;
        }

        const [result] = await db.execute(
            'INSERT INTO tasks (title, area, description, assignee_id, evidence_url, created_by_id) VALUES (?, ?, ?, ?, ?, ?)',
            [title, area, description, assigneeId || null, evidenceUrl, req.user.userId]
        );

        // Get the created task with user details
        const [tasks] = await db.execute(`
            SELECT t.*, 
                   u1.username as created_by_username,
                   u1.discord_id as creator_discord_id,
                   u2.username as assignee_username,
                   u2.discord_id as assignee_discord_id
            FROM tasks t
            LEFT JOIN users u1 ON t.created_by_id = u1.id  
            LEFT JOIN users u2 ON t.assignee_id = u2.id
            WHERE t.id = ?
        `, [result.insertId]);

        const task = tasks[0];

        // Send Discord notifications
        await sendTaskNotification(task, 'new');
        
        if (task.assignee_discord_id) {
            await sendAssignmentDM(task.assignee_discord_id, task);
        }

        res.status(201).json(task);
    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/api/tasks/:id/status', authenticateToken, requireRole(['developer', 'admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { status, rejectionReason } = req.body;

        if (!['pending', 'progress', 'completed', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        // Get current task to check permissions
        const [currentTasks] = await db.execute(
            'SELECT * FROM tasks WHERE id = ?',
            [id]
        );

        if (currentTasks.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const currentTask = currentTasks[0];

        // Check if user is assigned to this task (unless admin)
        if (req.user.role !== 'admin' && currentTask.assignee_id !== req.user.userId) {
            return res.status(403).json({ error: 'You can only update tasks assigned to you' });
        }

        // Update task
        await db.execute(
            'UPDATE tasks SET status = ?, rejection_reason = ? WHERE id = ?',
            [status, status === 'rejected' ? rejectionReason : null, id]
        );

        // Get updated task with user details
        const [tasks] = await db.execute(`
            SELECT t.*, 
                   u1.username as created_by_username,
                   u1.discord_id as creator_discord_id,
                   u2.username as assignee_username,
                   u2.discord_id as assignee_discord_id
            FROM tasks t
            LEFT JOIN users u1 ON t.created_by_id = u1.id  
            LEFT JOIN users u2 ON t.assignee_id = u2.id
            WHERE t.id = ?
        `, [id]);

        const task = tasks[0];

        // Send Discord notification
        await sendTaskNotification(task, status);

        res.json(task);
    } catch (error) {
        console.error('Update task status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/api/tasks/:id/assign', authenticateToken, requireRole(['developer', 'admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { assigneeId } = req.body;

        await db.execute('UPDATE tasks SET assignee_id = ? WHERE id = ?', [assigneeId, id]);

        // Get updated task
        const [tasks] = await db.execute(`
            SELECT t.*, 
                   u1.username as created_by_username,
                   u2.username as assignee_username,
                   u2.discord_id as assignee_discord_id
            FROM tasks t
            LEFT JOIN users u1 ON t.created_by_id = u1.id  
            LEFT JOIN users u2 ON t.assignee_id = u2.id
            WHERE t.id = ?
        `, [id]);

        const task = tasks[0];

        // Send DM to newly assigned user
        if (task.assignee_discord_id) {
            await sendAssignmentDM(task.assignee_discord_id, task);
        }

        res.json(task);
    } catch (error) {
        console.error('Assign task error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Statistics Routes
app.get('/api/statistics', authenticateToken, async (req, res) => {
    try {
        const [totalTasks] = await db.execute('SELECT COUNT(*) as count FROM tasks');
        const [completedTasks] = await db.execute('SELECT COUNT(*) as count FROM tasks WHERE status = "completed"');
        const [inProgressTasks] = await db.execute('SELECT COUNT(*) as count FROM tasks WHERE status = "progress"');
        const [pendingTasks] = await db.execute('SELECT COUNT(*) as count FROM tasks WHERE status = "pending"');
        const [rejectedTasks] = await db.execute('SELECT COUNT(*) as count FROM tasks WHERE status = "rejected"');
        
        const [myCreatedTasks] = await db.execute('SELECT COUNT(*) as count FROM tasks WHERE created_by_id = ?', [req.user.userId]);
        const [myCompletedTasks] = await db.execute('SELECT COUNT(*) as count FROM tasks WHERE assignee_id = ? AND status = "completed"', [req.user.userId]);
        
        // Top creators
        const [topCreators] = await db.execute(`
            SELECT u.username, COUNT(t.id) as task_count
            FROM users u
            LEFT JOIN tasks t ON u.id = t.created_by_id
            WHERE u.role IN ('staff', 'developer', 'admin')
            GROUP BY u.id, u.username
            ORDER BY task_count DESC
            LIMIT 10
        `);
        
        // Top developers
        const [topDevelopers] = await db.execute(`
            SELECT u.username, COUNT(t.id) as completed_count
            FROM users u
            LEFT JOIN tasks t ON u.id = t.assignee_id AND t.status = 'completed'
            WHERE u.role IN ('developer', 'admin')
            GROUP BY u.id, u.username
            ORDER BY completed_count DESC
            LIMIT 10
        `);

        res.json({
            overview: {
                total: totalTasks[0].count,
                completed: completedTasks[0].count,
                inProgress: inProgressTasks[0].count,
                pending: pendingTasks[0].count,
                rejected: rejectedTasks[0].count
            },
            personal: {
                created: myCreatedTasks[0].count,
                completed: myCompletedTasks[0].count
            },
            leaderboards: {
                topCreators,
                topDevelopers
            }
        });
    } catch (error) {
        console.error('Statistics error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Discord linking route
app.post('/api/link-discord', authenticateToken, async (req, res) => {
    try {
        const { discordId, discordUsername } = req.body;
        
        await db.execute(
            'UPDATE users SET discord_id = ?, discord_username = ? WHERE id = ?',
            [discordId, discordUsername, req.user.userId]
        );
        
        res.json({ message: 'Discord account linked successfully' });
    } catch (error) {
        console.error('Link Discord error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add this to your script.js file after the other routes

// Discord linking routes
app.post('/api/link-discord', authenticateToken, async (req, res) => {
    try {
        const { discordId, discordUsername } = req.body;
        
        if (!discordId || !discordUsername) {
            return res.status(400).json({ error: 'Discord ID and username are required' });
        }

        // Check if Discord ID is already linked to another account
        const [existingUsers] = await db.execute(
            'SELECT username FROM users WHERE discord_id = ? AND id != ?',
            [discordId, req.user.userId]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({ 
                error: `Discord account is already linked to user: ${existingUsers[0].username}` 
            });
        }
        
        await db.execute(
            'UPDATE users SET discord_id = ?, discord_username = ? WHERE id = ?',
            [discordId, discordUsername, req.user.userId]
        );
        
        res.json({ message: 'Discord account linked successfully!' });
    } catch (error) {
        console.error('Link Discord error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user's Discord link status
app.get('/api/discord-status', authenticateToken, async (req, res) => {
    try {
        const [users] = await db.execute(
            'SELECT discord_id, discord_username FROM users WHERE id = ?',
            [req.user.userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = users[0];
        res.json({
            linked: !!user.discord_id,
            discordId: user.discord_id,
            discordUsername: user.discord_username
        });
    } catch (error) {
        console.error('Discord status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Unlink Discord account
app.delete('/api/unlink-discord', authenticateToken, async (req, res) => {
    try {
        await db.execute(
            'UPDATE users SET discord_id = NULL, discord_username = NULL WHERE id = ?',
            [req.user.userId]
        );
        
        res.json({ message: 'Discord account unlinked successfully!' });
    } catch (error) {
        console.error('Unlink Discord error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server
async function startServer() {
    try {
        await initDatabase();
        
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    
    if (db) {
        await db.end();
        console.log('✅ Database connection closed');
    }
    
    discordClient.destroy();
    console.log('✅ Discord bot disconnected');
    
    process.exit(0);
});

startServer();